import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Enums } from "@/lib/types/database.types"

export type OverviewStats = {
  totalProducts: number
  totalCampaigns: number
  activeCampaigns: number
  campaignsByProduct: Record<string, number>
}

const EMPTY_STATUS_COUNTS: Record<Enums<"campaign_status">, number> = {
  DRAFT: 0,
  ACTIVE: 0,
  PAUSED: 0,
  COMPLETED: 0,
  ARCHIVED: 0,
}

export type CampaignStatsInput = {
  product_id: string
  status: Enums<"campaign_status">
}[]

// Pure aggregation, kept separate from the fetch so it's unit-testable
// without mocking the Supabase client - see lib/services/__tests__.
export function summarizeCampaigns(
  campaigns: CampaignStatsInput,
  totalProducts: number
): OverviewStats {
  const statusCounts = { ...EMPTY_STATUS_COUNTS }
  const campaignsByProduct: Record<string, number> = {}

  for (const campaign of campaigns) {
    statusCounts[campaign.status] += 1
    campaignsByProduct[campaign.product_id] =
      (campaignsByProduct[campaign.product_id] ?? 0) + 1
  }

  return {
    totalProducts,
    totalCampaigns: campaigns.length,
    activeCampaigns: statusCounts.ACTIVE,
    campaignsByProduct,
  }
}

// Traffic/conversion KPIs from the full spec still need tables that arrive
// in later phases (campaign_events/signatures in Phase 6-7). Rather than
// fabricate zeros for those, callers should render "not available yet" -
// see app/(dashboard)/overview/page.tsx.
export async function getOverviewStats(
  supabase: SupabaseClient<Database>
): Promise<OverviewStats> {
  const [{ count: totalProducts }, campaigns] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("campaigns").select("id, product_id, status"),
  ])

  if (campaigns.error) {
    throw new Error(`Failed to load campaign stats: ${campaigns.error.message}`)
  }

  return summarizeCampaigns(campaigns.data, totalProducts ?? 0)
}

export type PipelineStats = {
  totalProspects: number
  statusCounts: Record<Enums<"pipeline_status">, number>
  scoredCount: number
  highValueUncontactedCount: number
}

const EMPTY_PIPELINE_STATUS_COUNTS: Record<Enums<"pipeline_status">, number> = {
  NEW: 0,
  QUALIFIED: 0,
  CONTACTED: 0,
  REPLIED: 0,
  MEETING: 0,
  PROPOSAL: 0,
  WON: 0,
  LOST: 0,
}

export type PipelineStatsInput = {
  pipeline_status: Enums<"pipeline_status">
  classification: Enums<"lead_classification"> | null
}[]

// Pure aggregation - unit-testable without mocking Supabase.
export function summarizePipeline(businesses: PipelineStatsInput): PipelineStats {
  const statusCounts = { ...EMPTY_PIPELINE_STATUS_COUNTS }
  let scoredCount = 0
  let highValueUncontactedCount = 0

  for (const business of businesses) {
    statusCounts[business.pipeline_status] += 1
    if (business.classification) {
      scoredCount += 1
      if (
        (business.classification === "EXCEPTIONAL" || business.classification === "HIGH") &&
        business.pipeline_status === "NEW"
      ) {
        highValueUncontactedCount += 1
      }
    }
  }

  return {
    totalProspects: businesses.length,
    statusCounts,
    scoredCount,
    highValueUncontactedCount,
  }
}

export type OutreachStats = {
  qualifiedProspects: number
  prospectsWithOpportunities: number
  prospectsReadyForOutreach: number
  draftsAwaitingReview: number
  approvedDrafts: number
  highPriorityOpportunities: number
  messagesSentByChannel: Record<Enums<"outreach_channel">, number>
  sendFailures: number
  /** 0-100, or null if there are no completed send attempts yet (never show a misleading 0%). */
  sendSuccessRate: number | null
  sentByIndustry: Record<string, number>
}

const EMPTY_CHANNEL_COUNTS: Record<Enums<"outreach_channel">, number> = { WHATSAPP: 0, EMAIL: 0 }

export type SendAttemptStatsInput = { status: Enums<"send_attempt_status">; channel: Enums<"outreach_channel">; business_id: string }[]

// Pure aggregation - unit-testable without mocking Supabase. Real counts
// only (spec section 42): no reply/meeting/conversion metrics (those
// need infrastructure this app doesn't have yet - Phase 6+).
export function summarizeSendAttempts(
  attempts: SendAttemptStatsInput,
  industryByBusinessId: Map<string, string | null>
): {
  messagesSentByChannel: Record<Enums<"outreach_channel">, number>
  sendFailures: number
  sendSuccessRate: number | null
  sentByIndustry: Record<string, number>
} {
  const messagesSentByChannel = { ...EMPTY_CHANNEL_COUNTS }
  const sentByIndustry: Record<string, number> = {}
  let sent = 0
  let failed = 0

  for (const attempt of attempts) {
    if (attempt.status === "SENT") {
      sent += 1
      messagesSentByChannel[attempt.channel] += 1
      const industry = industryByBusinessId.get(attempt.business_id) ?? "Unknown"
      sentByIndustry[industry] = (sentByIndustry[industry] ?? 0) + 1
    } else if (attempt.status === "FAILED") {
      failed += 1
    }
  }

  const completed = sent + failed
  return {
    messagesSentByChannel,
    sendFailures: failed,
    sendSuccessRate: completed > 0 ? Math.round((sent / completed) * 100) : null,
    sentByIndustry,
  }
}

// Real database counts only - no fabricated numbers (spec section 34).
// "Ready for outreach" and "with opportunities" are computed as distinct
// businesses, not row counts, since a business can have several
// opportunities/one active strategy.
export async function getOutreachStats(supabase: SupabaseClient<Database>): Promise<OutreachStats> {
  const [
    qualifiedResult,
    opportunitiesResult,
    strategiesResult,
    needsReviewResult,
    approvedResult,
    highPriorityResult,
    sendAttemptsResult,
  ] = await Promise.all([
    supabase.from("businesses").select("*", { count: "exact", head: true }).eq("pipeline_status", "QUALIFIED"),
    supabase.from("opportunities").select("business_id").not("status", "eq", "REJECTED").not("status", "eq", "CLOSED"),
    supabase.from("sales_strategies").select("business_id, recommended_channel").eq("status", "ACTIVE"),
    supabase.from("outreach_drafts").select("*", { count: "exact", head: true }).eq("status", "NEEDS_REVIEW"),
    supabase.from("outreach_drafts").select("*", { count: "exact", head: true }).eq("status", "READY_TO_SEND"),
    supabase.from("opportunities").select("status").in("priority", ["CRITICAL", "HIGH"]),
    supabase.from("outreach_send_attempts").select("status, channel, business_id"),
  ])

  if (qualifiedResult.error) throw new Error(`Failed to load qualified prospect count: ${qualifiedResult.error.message}`)
  if (opportunitiesResult.error) throw new Error(`Failed to load opportunities: ${opportunitiesResult.error.message}`)
  if (strategiesResult.error) throw new Error(`Failed to load sales strategies: ${strategiesResult.error.message}`)
  if (needsReviewResult.error) throw new Error(`Failed to load drafts needing review: ${needsReviewResult.error.message}`)
  if (approvedResult.error) throw new Error(`Failed to load approved drafts: ${approvedResult.error.message}`)
  if (highPriorityResult.error) throw new Error(`Failed to load high-priority opportunities: ${highPriorityResult.error.message}`)
  if (sendAttemptsResult.error) throw new Error(`Failed to load send attempts: ${sendAttemptsResult.error.message}`)

  const prospectsWithOpportunities = new Set(opportunitiesResult.data.map((o) => o.business_id)).size
  const prospectsReadyForOutreach = new Set(
    strategiesResult.data.filter((s) => s.recommended_channel !== "NONE").map((s) => s.business_id)
  ).size
  const highPriorityOpportunities = highPriorityResult.data.filter(
    (o) => o.status !== "REJECTED" && o.status !== "CLOSED"
  ).length

  const sentBusinessIds = [...new Set(sendAttemptsResult.data.map((a) => a.business_id))]
  const industryByBusinessId = new Map<string, string | null>()
  if (sentBusinessIds.length > 0) {
    const { data: industries, error: industryError } = await supabase
      .from("businesses")
      .select("id, industry")
      .in("id", sentBusinessIds)
    if (industryError) throw new Error(`Failed to load business industries: ${industryError.message}`)
    for (const b of industries) industryByBusinessId.set(b.id, b.industry)
  }
  const sendStats = summarizeSendAttempts(sendAttemptsResult.data, industryByBusinessId)

  return {
    qualifiedProspects: qualifiedResult.count ?? 0,
    prospectsWithOpportunities,
    prospectsReadyForOutreach,
    draftsAwaitingReview: needsReviewResult.count ?? 0,
    approvedDrafts: approvedResult.count ?? 0,
    highPriorityOpportunities,
    ...sendStats,
  }
}

export async function getPipelineStats(supabase: SupabaseClient<Database>): Promise<PipelineStats> {
  const { data, error } = await supabase
    .from("businesses")
    .select("pipeline_status, lead_scores(classification)")
    .returns<{ pipeline_status: Enums<"pipeline_status">; lead_scores: { classification: Enums<"lead_classification"> }[] | { classification: Enums<"lead_classification"> } | null }[]>()

  if (error) throw new Error(`Failed to load pipeline stats: ${error.message}`)

  return summarizePipeline(
    data.map((row) => {
      const leadScore = Array.isArray(row.lead_scores) ? (row.lead_scores[0] ?? null) : row.lead_scores
      return { pipeline_status: row.pipeline_status, classification: leadScore?.classification ?? null }
    })
  )
}

export type ResponseStats = {
  needsResponseCount: number
  uniqueContactedCount: number
  uniqueRespondedCount: number
  interestedCount: number
  /** unique responded / unique contacted, 0-100, or null with no sends yet. Never double-counts a prospect who sent several replies. */
  responseRate: number | null
  whatsappResponseRate: number | null
  emailResponseRate: number | null
  /** The remaining rates are per classified response (message), not per unique prospect - see summarizeResponseRates. */
  positiveResponseRate: number | null
  meetingRequestRate: number | null
  pricingRequestRate: number | null
  objectionRate: number | null
  optOutRate: number | null
}

export type SendForResponseRate = { business_id: string; channel: Enums<"outreach_channel"> }
export type ResponseForRate = { business_id: string; channel: Enums<"outreach_channel">; intent: Enums<"response_intent"> | null }

function ratePercent(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : null
}

// Pure aggregation - unit-testable without mocking Supabase. Response
// rate is computed over unique businesses (spec section 27: never count
// the same prospect's several replies as several responding leads); the
// intent-breakdown rates are computed over classified responses (messages)
// instead, since "meeting-request rate" etc. are naturally about the
// share of replies with that intent, not a per-prospect count.
export function summarizeResponseRates(
  sentAttempts: SendForResponseRate[],
  responses: ResponseForRate[]
): Omit<ResponseStats, "needsResponseCount" | "interestedCount"> & { interestedCount: number } {
  const contacted = new Set(sentAttempts.map((a) => a.business_id))
  const responded = new Set(responses.map((r) => r.business_id))
  const contactedByChannel = (channel: Enums<"outreach_channel">) =>
    new Set(sentAttempts.filter((a) => a.channel === channel).map((a) => a.business_id)).size
  const respondedByChannel = (channel: Enums<"outreach_channel">) =>
    new Set(responses.filter((r) => r.channel === channel).map((r) => r.business_id)).size

  const classified = responses.filter((r) => r.intent !== null)
  const countByIntent = (intent: Enums<"response_intent">) => classified.filter((r) => r.intent === intent).length

  return {
    uniqueContactedCount: contacted.size,
    uniqueRespondedCount: responded.size,
    interestedCount: countByIntent("INTERESTED"),
    responseRate: ratePercent(responded.size, contacted.size),
    whatsappResponseRate: ratePercent(respondedByChannel("WHATSAPP"), contactedByChannel("WHATSAPP")),
    emailResponseRate: ratePercent(respondedByChannel("EMAIL"), contactedByChannel("EMAIL")),
    positiveResponseRate: ratePercent(countByIntent("INTERESTED") + countByIntent("POSITIVE_GENERAL"), classified.length),
    meetingRequestRate: ratePercent(countByIntent("REQUEST_FOR_MEETING"), classified.length),
    pricingRequestRate: ratePercent(countByIntent("REQUEST_FOR_PRICING"), classified.length),
    objectionRate: ratePercent(countByIntent("OBJECTION"), classified.length),
    optOutRate: ratePercent(countByIntent("OPT_OUT"), classified.length),
  }
}

export async function getResponseStats(supabase: SupabaseClient<Database>): Promise<ResponseStats> {
  const [needsResponseResult, sentResult, responsesResult] = await Promise.all([
    supabase.from("conversations").select("*", { count: "exact", head: true }).eq("status", "WAITING_FOR_US"),
    supabase.from("outreach_send_attempts").select("business_id, channel").eq("status", "SENT"),
    supabase.from("inbound_messages").select("business_id, channel, intent").not("business_id", "is", null),
  ])
  if (needsResponseResult.error) throw new Error(`Failed to count conversations needing response: ${needsResponseResult.error.message}`)
  if (sentResult.error) throw new Error(`Failed to load sent messages: ${sentResult.error.message}`)
  if (responsesResult.error) throw new Error(`Failed to load responses: ${responsesResult.error.message}`)

  const rates = summarizeResponseRates(
    sentResult.data,
    responsesResult.data as ResponseForRate[]
  )

  return { needsResponseCount: needsResponseResult.count ?? 0, ...rates }
}

export type OpportunityResponseStats = {
  opportunityType: Enums<"opportunity_type">
  contactedCount: number
  respondedCount: number
  interestedCount: number
}

// "Which opportunities produce the most responses" (spec section 28) -
// one join from outreach_send_attempts through outreach_drafts to the
// opportunity it was about, grouped by type. Real counts only: an
// opportunity type with no sends yet simply doesn't appear.
export async function getOpportunityResponseStats(supabase: SupabaseClient<Database>): Promise<OpportunityResponseStats[]> {
  const { data: sentDrafts, error: sentError } = await supabase
    .from("outreach_send_attempts")
    .select("business_id, outreach_draft_id")
    .eq("status", "SENT")
  if (sentError) throw new Error(`Failed to load sent messages: ${sentError.message}`)
  if (sentDrafts.length === 0) return []

  const draftIds = [...new Set(sentDrafts.map((s) => s.outreach_draft_id))]
  const { data: drafts, error: draftsError } = await supabase
    .from("outreach_drafts")
    .select("id, opportunity_id")
    .in("id", draftIds)
  if (draftsError) throw new Error(`Failed to load drafts: ${draftsError.message}`)

  const opportunityIds = [...new Set(drafts.map((d) => d.opportunity_id))]
  const { data: opportunities, error: opportunitiesError } = await supabase
    .from("opportunities")
    .select("id, opportunity_type")
    .in("id", opportunityIds)
  if (opportunitiesError) throw new Error(`Failed to load opportunities: ${opportunitiesError.message}`)

  const { data: responses, error: responsesError } = await supabase
    .from("inbound_messages")
    .select("business_id, intent")
    .not("business_id", "is", null)
  if (responsesError) throw new Error(`Failed to load responses: ${responsesError.message}`)

  const opportunityTypeByDraftId = new Map<string, Enums<"opportunity_type">>()
  const opportunityTypeById = new Map(opportunities.map((o) => [o.id, o.opportunity_type]))
  for (const draft of drafts) {
    const type = opportunityTypeById.get(draft.opportunity_id)
    if (type) opportunityTypeByDraftId.set(draft.id, type)
  }

  const respondedBusinessIds = new Set(responses.map((r) => r.business_id))
  const interestedBusinessIds = new Set(responses.filter((r) => r.intent === "INTERESTED").map((r) => r.business_id))

  const contactedByType = new Map<Enums<"opportunity_type">, Set<string>>()
  const respondedByType = new Map<Enums<"opportunity_type">, Set<string>>()
  const interestedByType = new Map<Enums<"opportunity_type">, Set<string>>()

  for (const sent of sentDrafts) {
    const type = opportunityTypeByDraftId.get(sent.outreach_draft_id)
    if (!type) continue
    if (!contactedByType.has(type)) contactedByType.set(type, new Set())
    contactedByType.get(type)!.add(sent.business_id)
    if (respondedBusinessIds.has(sent.business_id)) {
      if (!respondedByType.has(type)) respondedByType.set(type, new Set())
      respondedByType.get(type)!.add(sent.business_id)
    }
    if (interestedBusinessIds.has(sent.business_id)) {
      if (!interestedByType.has(type)) interestedByType.set(type, new Set())
      interestedByType.get(type)!.add(sent.business_id)
    }
  }

  return [...contactedByType.entries()]
    .map(([opportunityType, contactedSet]) => ({
      opportunityType,
      contactedCount: contactedSet.size,
      respondedCount: respondedByType.get(opportunityType)?.size ?? 0,
      interestedCount: interestedByType.get(opportunityType)?.size ?? 0,
    }))
    .sort((a, b) => b.respondedCount - a.respondedCount)
}
