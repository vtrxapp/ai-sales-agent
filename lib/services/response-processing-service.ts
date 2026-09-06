import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { after } from "next/server"

import type { Database, Tables } from "@/lib/types/database.types"
import type { AIProvider } from "@/lib/ai/types"
import { getAIProvider } from "@/lib/ai"
import type { InboundMessageProvider, NormalizedInboundMessage } from "@/lib/inbound/types"
import { matchInboundSender, findOrCreateConversation } from "@/lib/services/response-matching-service"
import { classifyInboundMessage } from "@/lib/services/response-classification-service"
import { setDoNotContact, updateBusinessStatus } from "@/lib/services/business-service"
import { logActivity } from "@/lib/services/activity-service"

export type ProcessInboundMessageResult =
  | { outcome: "STORED"; message: Tables<"inbound_messages">; conversation: Tables<"conversations"> }
  | { outcome: "UNMATCHED"; message: Tables<"inbound_messages"> }
  | { outcome: "DUPLICATE" }

function isDuplicateKeyError(error: { code?: string; message: string }): boolean {
  return error.code === "23505" || /duplicate key value/i.test(error.message)
}

// The single entry point the webhook routes call per extracted message.
// Runs the full spec section 9 pipeline: match sender -> find/create
// conversation -> store message -> update conversation -> log activity.
// Idempotent via the unique(provider, external_message_id) constraint -
// a webhook retry for a message already stored returns DUPLICATE rather
// than storing (or classifying) it again.
export async function processInboundMessage(
  supabase: SupabaseClient<Database>,
  normalized: NormalizedInboundMessage
): Promise<ProcessInboundMessageResult> {
  const match = await matchInboundSender(supabase, normalized.channel, normalized.senderIdentifier)

  let conversation: Tables<"conversations"> | null = null
  if (match) {
    conversation = await findOrCreateConversation(
      supabase,
      match.business.id,
      match.contact?.id ?? null,
      normalized.channel,
      normalized.provider
    )
  }

  const { data: message, error } = await supabase
    .from("inbound_messages")
    .insert({
      conversation_id: conversation?.id ?? null,
      business_id: match?.business.id ?? null,
      contact_id: match?.contact?.id ?? null,
      channel: normalized.channel,
      provider: normalized.provider,
      external_message_id: normalized.externalMessageId,
      external_conversation_id: normalized.externalConversationId,
      sender_identifier: normalized.senderIdentifier,
      recipient_identifier: normalized.recipientIdentifier,
      message_body: normalized.messageBody,
      received_at: normalized.receivedAt,
      raw_type: normalized.rawType,
      metadata: normalized.metadata,
      processing_status: conversation ? "MATCHED" : "UNMATCHED",
      classification_status: normalized.metadata.unsupported_type ? "SKIPPED" : "PENDING",
    })
    .select()
    .single()

  if (error) {
    if (isDuplicateKeyError(error)) return { outcome: "DUPLICATE" }
    throw new Error(`Failed to store inbound message: ${error.message}`)
  }

  if (!conversation) {
    await logActivity(supabase, {
      entityType: "inbound_message",
      entityId: message.id,
      activityType: "RESPONSE_UNMATCHED",
      description: `An inbound ${normalized.channel} message from ${normalized.senderIdentifier} could not be matched to a known business.`,
      actorId: null,
      metadata: { channel: normalized.channel, sender: normalized.senderIdentifier },
    })
    return { outcome: "UNMATCHED", message }
  }

  // A suppressed conversation is never silently reopened by an inbound
  // message - the human already decided this business shouldn't be
  // engaged further, and receiving one more message from them doesn't
  // change that (they can still be found and un-suppressed manually).
  const nextStatus = conversation.status === "DO_NOT_CONTACT" ? "DO_NOT_CONTACT" : "WAITING_FOR_US"
  const { data: updatedConversation, error: convError } = await supabase
    .from("conversations")
    .update({
      status: nextStatus,
      last_message_at: normalized.receivedAt,
      last_inbound_at: normalized.receivedAt,
      unread_count: conversation.unread_count + 1,
    })
    .eq("id", conversation.id)
    .select()
    .single()
  if (convError) throw new Error(`Failed to update conversation: ${convError.message}`)

  await logActivity(supabase, {
    entityType: "business",
    entityId: match!.business.id,
    activityType: "RESPONSE_RECEIVED",
    description: `${match!.business.name} replied via ${normalized.channel}.`,
    actorId: null,
    metadata: { conversation_id: conversation.id, inbound_message_id: message.id, channel: normalized.channel },
  })

  return { outcome: "STORED", message, conversation: updatedConversation }
}

// Server-side enforcement of opt-out (spec section 14): sets
// businesses.do_not_contact, which sendOutreachMessage (Phase 5) already
// checks before any send - this function doesn't need to separately
// "block" sending, it just sets the flag that already blocks it.
// Idempotent: a second opt-out on an already-suppressed business is a
// harmless no-op.
export async function handleOptOut(
  supabase: SupabaseClient<Database>,
  business: Tables<"businesses">,
  conversationId: string | null
): Promise<void> {
  if (!business.do_not_contact) {
    await setDoNotContact(
      supabase,
      business.id,
      "Detected automatically from an inbound reply asking not to be contacted.",
      null
    )
  }
  if (conversationId) {
    await supabase.from("conversations").update({ status: "DO_NOT_CONTACT" }).eq("id", conversationId)
  }
}

// CONTACTED -> REPLIED only, per spec section 16 - never auto-advances
// to MEETING/PROPOSAL/WON just because a reply arrived, regardless of
// how positive the classified intent is. A human decides those
// transitions from the recommended action, not this function.
export async function syncCrmOnResponse(
  supabase: SupabaseClient<Database>,
  business: Tables<"businesses">
): Promise<void> {
  if (business.pipeline_status !== "CONTACTED") return
  await updateBusinessStatus(supabase, business.id, "REPLIED", null)
}

// Best-effort classification + downstream actions for one just-stored
// message. Never throws: a classification failure (AI unavailable,
// unexpected response) leaves the message stored and visible with
// classification_status FAILED rather than losing the webhook delivery
// or the message itself (spec section 37: provider failures should
// never crash the webhook unnecessarily).
export async function classifyAndActOnMessage(
  supabase: SupabaseClient<Database>,
  ai: AIProvider,
  message: Tables<"inbound_messages">,
  business: Tables<"businesses">,
  conversationId: string | null
): Promise<void> {
  if (message.classification_status === "SKIPPED") return

  let classified: Tables<"inbound_messages">
  try {
    classified = await classifyInboundMessage(supabase, ai, message)
  } catch {
    return
  }

  if (classified.intent === "OPT_OUT") {
    await handleOptOut(supabase, business, conversationId)
    await logActivity(supabase, {
      entityType: "business",
      entityId: business.id,
      activityType: "OPT_OUT_DETECTED",
      description: `${business.name} asked not to be contacted again - marked Do Not Contact automatically.`,
      actorId: null,
      metadata: { inbound_message_id: message.id },
    })
    return
  }

  await syncCrmOnResponse(supabase, business)
}

export type WebhookDeliveryOutcome = { stored: number; unmatched: number; duplicate: number; skipped: number }

// Shared by both webhook routes (spec section 36: providers stay
// interchangeable behind InboundMessageProvider). Storing each message is
// synchronous - required for correctness, and fast. Classification is
// scheduled via Next's after() to run once the response has already been
// sent, so a slow/unconfigured AI call can never make Meta or Resend time
// out and retry a delivery that was already stored (spec section 37).
export async function handleInboundWebhookDelivery(
  supabase: SupabaseClient<Database>,
  provider: InboundMessageProvider,
  rawBody: string
): Promise<WebhookDeliveryOutcome> {
  const messages = await provider.extractInboundMessages(rawBody)
  const outcome: WebhookDeliveryOutcome = { stored: 0, unmatched: 0, duplicate: 0, skipped: 0 }

  for (const normalized of messages) {
    const result = await processInboundMessage(supabase, normalized)
    if (result.outcome === "DUPLICATE") {
      outcome.duplicate += 1
      continue
    }
    if (result.outcome === "UNMATCHED") {
      outcome.unmatched += 1
      continue
    }

    outcome.stored += 1
    if (result.message.classification_status === "SKIPPED") {
      outcome.skipped += 1
      continue
    }

    const { message, conversation } = result
    after(async () => {
      try {
        const ai = getAIProvider()
        const { data: business } = await supabase.from("businesses").select("*").eq("id", message.business_id as string).single()
        if (!business) return
        await classifyAndActOnMessage(supabase, ai, message, business, conversation.id)
      } catch {
        // AI not configured, or a genuine classification failure - the
        // message stays stored and visible with classification_status
        // PENDING/FAILED rather than being lost or retried indefinitely.
      }
    })
  }

  return outcome
}
