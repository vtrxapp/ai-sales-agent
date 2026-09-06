import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Enums, Tables } from "@/lib/types/database.types"

export type ConversationSummary = Tables<"conversations"> & {
  businessName: string
  businessIndustry: string | null
  pipelineStatus: Enums<"pipeline_status">
  leadScoreTotal: number | null
  leadScoreClassification: Enums<"lead_classification"> | null
  latestMessage: Pick<
    Tables<"inbound_messages">,
    "id" | "message_body" | "received_at" | "intent" | "sentiment" | "urgency" | "recommended_action" | "recommended_action_reason" | "classification_status"
  > | null
}

// Denormalized "who replied and what does it mean" view for /responses
// (spec section 18) - conversations first, businesses/lead scores/
// latest message joined in application code rather than a single large
// query, matching the fetch-separately-then-merge pattern already used
// for BusinessDetail and the Phase 5 send history.
export async function listConversationSummaries(supabase: SupabaseClient<Database>): Promise<ConversationSummary[]> {
  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("*")
    .order("last_message_at", { ascending: false, nullsFirst: false })
  if (error) throw new Error(`Failed to load conversations: ${error.message}`)
  if (conversations.length === 0) return []

  const businessIds = [...new Set(conversations.map((c) => c.business_id))]
  const conversationIds = conversations.map((c) => c.id)

  const [businessesResult, leadScoresResult, messagesResult] = await Promise.all([
    supabase.from("businesses").select("id, name, industry, pipeline_status").in("id", businessIds),
    supabase.from("lead_scores").select("business_id, total_score, classification").in("business_id", businessIds),
    supabase
      .from("inbound_messages")
      .select("id, conversation_id, message_body, received_at, intent, sentiment, urgency, recommended_action, recommended_action_reason, classification_status")
      .in("conversation_id", conversationIds)
      .order("received_at", { ascending: false }),
  ])
  if (businessesResult.error) throw new Error(`Failed to load businesses: ${businessesResult.error.message}`)
  if (leadScoresResult.error) throw new Error(`Failed to load lead scores: ${leadScoresResult.error.message}`)
  if (messagesResult.error) throw new Error(`Failed to load messages: ${messagesResult.error.message}`)

  const businessById = new Map(businessesResult.data.map((b) => [b.id, b]))
  const leadScoreByBusinessId = new Map(leadScoresResult.data.map((s) => [s.business_id, s]))
  const latestMessageByConversationId = new Map<string, (typeof messagesResult.data)[number]>()
  for (const m of messagesResult.data) {
    if (m.conversation_id && !latestMessageByConversationId.has(m.conversation_id)) {
      latestMessageByConversationId.set(m.conversation_id, m)
    }
  }

  return conversations.map((c) => {
    const business = businessById.get(c.business_id)
    const leadScore = leadScoreByBusinessId.get(c.business_id)
    const latest = latestMessageByConversationId.get(c.id) ?? null
    return {
      ...c,
      businessName: business?.name ?? "Unknown business",
      businessIndustry: business?.industry ?? null,
      pipelineStatus: business?.pipeline_status ?? "NEW",
      leadScoreTotal: leadScore?.total_score ?? null,
      leadScoreClassification: leadScore?.classification ?? null,
      latestMessage: latest,
    }
  })
}

export type BusinessConversationSummary = Tables<"conversations"> & {
  latestMessage: Pick<
    Tables<"inbound_messages">,
    "id" | "message_body" | "received_at" | "intent" | "sentiment" | "recommended_action" | "recommended_action_reason" | "classification_status"
  > | null
  responseCount: number
}

// For the prospect page's Responses section - scoped to one business
// rather than the whole /responses dashboard.
export async function listConversationsForBusiness(
  supabase: SupabaseClient<Database>,
  businessId: string
): Promise<BusinessConversationSummary[]> {
  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("business_id", businessId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
  if (error) throw new Error(`Failed to load conversations: ${error.message}`)
  if (conversations.length === 0) return []

  const { data: messages, error: messagesError } = await supabase
    .from("inbound_messages")
    .select("id, conversation_id, message_body, received_at, intent, sentiment, recommended_action, recommended_action_reason, classification_status")
    .in(
      "conversation_id",
      conversations.map((c) => c.id)
    )
    .order("received_at", { ascending: false })
  if (messagesError) throw new Error(`Failed to load messages: ${messagesError.message}`)

  const latestByConversation = new Map<string, (typeof messages)[number]>()
  const countByConversation = new Map<string, number>()
  for (const m of messages) {
    if (!m.conversation_id) continue
    if (!latestByConversation.has(m.conversation_id)) latestByConversation.set(m.conversation_id, m)
    countByConversation.set(m.conversation_id, (countByConversation.get(m.conversation_id) ?? 0) + 1)
  }

  return conversations.map((c) => ({
    ...c,
    latestMessage: latestByConversation.get(c.id) ?? null,
    responseCount: countByConversation.get(c.id) ?? 0,
  }))
}

export async function countConversationsNeedingResponse(supabase: SupabaseClient<Database>): Promise<number> {
  const { count, error } = await supabase
    .from("conversations")
    .select("*", { count: "exact", head: true })
    .eq("status", "WAITING_FOR_US")
  if (error) throw new Error(`Failed to count conversations needing response: ${error.message}`)
  return count ?? 0
}

export type TimelineEntry =
  | {
      direction: "OUTBOUND"
      at: string
      channel: Enums<"outreach_channel">
      body: string
      subject: string | null
      providerMessageId: string | null
    }
  | { direction: "INBOUND"; at: string; channel: Enums<"outreach_channel">; message: Tables<"inbound_messages"> }

export type ConversationDetail = {
  conversation: Tables<"conversations">
  business: Tables<"businesses">
  contact: Tables<"contacts"> | null
  strategy: Tables<"sales_strategies"> | null
  leadScore: Tables<"lead_scores"> | null
  timeline: TimelineEntry[]
}

// Full timeline for /responses/[conversationId] (spec section 22):
// outbound messages come from the existing Phase 5 outreach_send_attempts
// (never a second outbound table - spec section 6), inbound from this
// phase's inbound_messages, merged and sorted chronologically.
export async function getConversationDetail(
  supabase: SupabaseClient<Database>,
  conversationId: string
): Promise<ConversationDetail | null> {
  const { data: conversation, error } = await supabase.from("conversations").select("*").eq("id", conversationId).single()
  if (error || !conversation) return null

  const [businessResult, contactResult, inboundResult, outboundResult, strategyResult, leadScoreResult] = await Promise.all([
    supabase.from("businesses").select("*").eq("id", conversation.business_id).single(),
    conversation.contact_id
      ? supabase.from("contacts").select("*").eq("id", conversation.contact_id).single()
      : Promise.resolve({ data: null, error: null } as { data: Tables<"contacts"> | null; error: null }),
    supabase.from("inbound_messages").select("*").eq("conversation_id", conversationId).order("received_at", { ascending: true }),
    supabase
      .from("outreach_send_attempts")
      .select("*")
      .eq("conversation_id", conversationId)
      .eq("status", "SENT")
      .order("attempted_at", { ascending: true }),
    supabase.from("sales_strategies").select("*").eq("business_id", conversation.business_id).eq("status", "ACTIVE").maybeSingle(),
    supabase.from("lead_scores").select("*").eq("business_id", conversation.business_id).maybeSingle(),
  ])
  if (businessResult.error || !businessResult.data) return null
  if (inboundResult.error) throw new Error(`Failed to load inbound messages: ${inboundResult.error.message}`)
  if (outboundResult.error) throw new Error(`Failed to load sent messages: ${outboundResult.error.message}`)
  if (strategyResult.error) throw new Error(`Failed to load sales strategy: ${strategyResult.error.message}`)
  if (leadScoreResult.error) throw new Error(`Failed to load lead score: ${leadScoreResult.error.message}`)

  const timeline: TimelineEntry[] = [
    ...outboundResult.data.map(
      (a): TimelineEntry => ({
        direction: "OUTBOUND",
        at: a.completed_at ?? a.attempted_at,
        channel: a.channel,
        body: a.message_body,
        subject: a.message_subject,
        providerMessageId: a.provider_message_id,
      })
    ),
    ...inboundResult.data.map((m): TimelineEntry => ({ direction: "INBOUND", at: m.received_at, channel: m.channel, message: m })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  return {
    conversation,
    business: businessResult.data,
    contact: contactResult.data,
    strategy: strategyResult.data,
    leadScore: leadScoreResult.data,
    timeline,
  }
}

export type UnmatchedMessage = Tables<"inbound_messages">

export async function listUnmatchedMessages(supabase: SupabaseClient<Database>): Promise<UnmatchedMessage[]> {
  const { data, error } = await supabase
    .from("inbound_messages")
    .select("*")
    .eq("processing_status", "UNMATCHED")
    .order("received_at", { ascending: false })
  if (error) throw new Error(`Failed to load unmatched messages: ${error.message}`)
  return data
}
