import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Enums, Tables } from "@/lib/types/database.types"
import type { OutreachProvider, OutreachRecipient, OutreachSendResult } from "@/lib/outreach/types"
import { getOutreachProvider } from "@/lib/outreach"
import { OutreachProviderError } from "@/lib/outreach/errors"
import { logActivity } from "@/lib/services/activity-service"

export type SendOutcome =
  | { outcome: "SENT"; draft: Tables<"outreach_drafts">; sendAttempt: Tables<"outreach_send_attempts"> }
  | { outcome: "FAILED"; draft: Tables<"outreach_drafts">; sendAttempt: Tables<"outreach_send_attempts"> }
  | { outcome: "ALREADY_SENT"; draft: Tables<"outreach_drafts">; sendAttempt: Tables<"outreach_send_attempts"> | null }
  | { outcome: "BLOCKED"; reason: string }

// Mirrors the exact precedence determineChannel/selectBestContact used
// when the channel was originally chosen (spec sections 7-8): a phone
// number is never treated as WhatsApp-capable without an explicit
// AVAILABLE status, and a named contact is preferred over the business's
// own fallback number/address. Re-checked here rather than trusted from
// draft-generation time, because whatsapp_status/email can legitimately
// change on the underlying contact/business between drafting and sending
// (spec: the server must verify current database state, never a stale
// assumption).
export function resolveRecipient(
  channel: Enums<"outreach_channel">,
  contact: Tables<"contacts"> | null,
  business: Tables<"businesses">
): OutreachRecipient | null {
  if (channel === "WHATSAPP") {
    if (contact?.whatsapp_status === "AVAILABLE" && contact.whatsapp_number) {
      return { name: contact.name, phone: contact.whatsapp_number }
    }
    if (business.whatsapp_status === "AVAILABLE" && business.whatsapp_number) {
      return { name: null, phone: business.whatsapp_number }
    }
    return null
  }
  if (contact?.email) {
    return { name: contact.name, email: contact.email }
  }
  if (business.email) {
    return { name: null, email: business.email }
  }
  return null
}

async function loadLatestSentAttempt(
  supabase: SupabaseClient<Database>,
  draftId: string
): Promise<Tables<"outreach_send_attempts"> | null> {
  const { data } = await supabase
    .from("outreach_send_attempts")
    .select("*")
    .eq("outreach_draft_id", draftId)
    .eq("status", "SENT")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

// The single entry point for actually sending an approved draft. Spec
// section 40's server-side steps, in the order implemented here: load
// draft -> verify status -> verify validation -> load business -> check
// suppression -> load+verify contact -> resolve recipient from trusted
// DB data -> resolve provider (channel/config check) -> acquire the
// idempotency lock -> record the attempt -> call the provider -> persist
// the outcome -> log activity -> return a sanitized result. Nothing here
// ever trusts a client-supplied message, recipient, or "this is
// approved" claim - every one of those is re-derived from the database
// inside this function.
export async function sendOutreachMessage(
  supabase: SupabaseClient<Database>,
  draftId: string,
  actorId: string
): Promise<SendOutcome> {
  const { data: draft, error: draftError } = await supabase.from("outreach_drafts").select("*").eq("id", draftId).single()
  if (draftError || !draft) return { outcome: "BLOCKED", reason: "This draft could not be found." }

  if (draft.status === "SENT") {
    return { outcome: "ALREADY_SENT", draft, sendAttempt: await loadLatestSentAttempt(supabase, draftId) }
  }
  if (draft.status === "SENDING") {
    return { outcome: "BLOCKED", reason: "A send for this message is already in progress." }
  }
  if (draft.status !== "READY_TO_SEND") {
    return {
      outcome: "BLOCKED",
      reason: `This draft is not ready to send (status: ${draft.status}). It must be approved first.`,
    }
  }
  if (draft.validation_status !== "PASSED") {
    return { outcome: "BLOCKED", reason: "This draft failed validation and cannot be sent." }
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", draft.business_id)
    .single()
  if (businessError || !business) return { outcome: "BLOCKED", reason: "The business for this draft could not be found." }

  if (business.do_not_contact) {
    return { outcome: "BLOCKED", reason: "This contact is marked Do Not Contact." }
  }

  let contact: Tables<"contacts"> | null = null
  if (draft.contact_id) {
    const { data: contactRow, error: contactError } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", draft.contact_id)
      .single()
    if (contactError || !contactRow) return { outcome: "BLOCKED", reason: "The contact for this draft could not be found." }
    if (contactRow.business_id !== draft.business_id) {
      return { outcome: "BLOCKED", reason: "This draft's contact no longer belongs to this business." }
    }
    contact = contactRow
  }

  const recipient = resolveRecipient(draft.channel, contact, business)
  if (!recipient || (!recipient.phone && !recipient.email)) {
    return {
      outcome: "BLOCKED",
      reason: `No valid ${draft.channel === "WHATSAPP" ? "WhatsApp number" : "email address"} is available for this recipient anymore.`,
    }
  }

  let provider: OutreachProvider
  try {
    provider = getOutreachProvider(draft.channel)
  } catch (err) {
    if (err instanceof OutreachProviderError) return { outcome: "BLOCKED", reason: err.message }
    throw err
  }

  // Idempotency layer 1: this UPDATE only affects a row still in
  // READY_TO_SEND. Postgres serializes concurrent UPDATEs on the same
  // row, so at most one concurrent caller can ever win this - a second
  // tab, a double click, or a retried request all see 0 rows affected
  // and stop here without ever reaching the provider call below.
  const { data: lockedDraft, error: lockError } = await supabase
    .from("outreach_drafts")
    .update({ status: "SENDING" })
    .eq("id", draftId)
    .eq("status", "READY_TO_SEND")
    .select()
    .single()

  if (lockError || !lockedDraft) {
    const { data: current } = await supabase.from("outreach_drafts").select("*").eq("id", draftId).single()
    if (current?.status === "SENT") {
      return { outcome: "ALREADY_SENT", draft: current, sendAttempt: await loadLatestSentAttempt(supabase, draftId) }
    }
    return { outcome: "BLOCKED", reason: "This message is already being sent or was already handled by another request." }
  }

  const recipientAddress = draft.channel === "WHATSAPP" ? (recipient.phone as string) : (recipient.email as string)

  // Idempotency layer 2: a unique partial index on (outreach_draft_id)
  // WHERE status = 'PENDING' makes a second PENDING row for the same
  // draft impossible at the database level, independent of the lock
  // above - defense in depth given supabase-js has no multi-statement
  // transaction to wrap both writes in (spec section 15: "use
  // server-side safeguards", plural).
  const { data: attempt, error: attemptInsertError } = await supabase
    .from("outreach_send_attempts")
    .insert({
      outreach_draft_id: draft.id,
      business_id: business.id,
      contact_id: contact?.id ?? null,
      // Set directly from the draft rather than looked up separately -
      // a response draft already carries the conversation it belongs to
      // (an initial-outreach draft has none yet, same as before this
      // column existed). This is what makes a sent response appear in
      // the conversation timeline immediately (spec section 22) instead
      // of depending on the one-time backfill in findOrCreateConversation,
      // which only ever runs once, when the conversation is first created.
      conversation_id: draft.conversation_id,
      channel: draft.channel,
      provider: provider.providerName,
      recipient_address: recipientAddress,
      sender_identity: provider.senderIdentity,
      message_body: draft.body,
      message_subject: draft.subject,
      status: "PENDING",
      created_by: actorId,
    })
    .select()
    .single()

  if (attemptInsertError || !attempt) {
    await supabase.from("outreach_drafts").update({ status: "READY_TO_SEND" }).eq("id", draftId).eq("status", "SENDING")
    return { outcome: "BLOCKED", reason: "A send for this message is already in progress." }
  }

  await logActivity(supabase, {
    entityType: "business",
    entityId: business.id,
    activityType: "OUTREACH_SEND_ATTEMPTED",
    description: `Sending ${draft.channel} message to ${business.name}...`,
    actorId,
    metadata: { draft_id: draft.id, send_attempt_id: attempt.id, channel: draft.channel },
  })

  // The message/recipient passed here come entirely from what this
  // function already loaded from the database above - never from the
  // caller. No AI call happens on this path (spec section 27): the
  // provider sends draft.body/draft.subject exactly as approved.
  let result: OutreachSendResult
  try {
    result = await provider.send(draft, recipient)
  } catch {
    result = {
      success: false,
      retryable: true,
      errorCode: "PROVIDER_THREW",
      errorMessage: "An unexpected error occurred while contacting the provider. This may be temporary.",
      providerName: provider.providerName,
    }
  }

  const completedAt = new Date().toISOString()

  if (result.success) {
    const { data: completedAttempt, error: attemptUpdateError } = await supabase
      .from("outreach_send_attempts")
      .update({ status: "SENT", provider_message_id: result.providerMessageId, completed_at: completedAt })
      .eq("id", attempt.id)
      .eq("status", "PENDING")
      .select()
      .single()
    if (attemptUpdateError || !completedAttempt) {
      throw new Error(`Failed to record successful send: ${attemptUpdateError?.message ?? "attempt row missing"}`)
    }

    const { data: sentDraft, error: draftUpdateError } = await supabase
      .from("outreach_drafts")
      .update({ status: "SENT" })
      .eq("id", draftId)
      .eq("status", "SENDING")
      .select()
      .single()
    if (draftUpdateError || !sentDraft) {
      throw new Error(`Failed to update draft status after send: ${draftUpdateError?.message ?? "draft row missing"}`)
    }

    // A response just sent means the ball is back in the prospect's
    // court - flips the conversation out of WAITING_FOR_US (spec section
    // 22: "clear needsResponse" / show "Waiting for prospect" instead of
    // "Needs response"). Never touches business.pipeline_status - sending
    // a reply is not the same as the deal progressing (spec section 23).
    if (sentDraft.conversation_id) {
      const { error: conversationUpdateError } = await supabase
        .from("conversations")
        .update({ status: "WAITING_FOR_THEM", last_outbound_at: completedAt, last_message_at: completedAt })
        .eq("id", sentDraft.conversation_id)
        .select()
        .single()
      if (conversationUpdateError) {
        throw new Error(`Failed to update conversation after send: ${conversationUpdateError.message}`)
      }
    }

    await logActivity(supabase, {
      entityType: "business",
      entityId: business.id,
      activityType: sentDraft.message_type === "RESPONSE" ? "RESPONSE_SENT" : "OUTREACH_SENT",
      description: `${draft.channel} message sent to ${business.name} via ${provider.providerName}.`,
      actorId,
      metadata: {
        draft_id: draft.id,
        send_attempt_id: completedAttempt.id,
        channel: draft.channel,
        provider: provider.providerName,
        provider_message_id: result.providerMessageId,
      },
    })

    return { outcome: "SENT", draft: sentDraft, sendAttempt: completedAttempt }
  }

  const { data: failedAttempt, error: attemptUpdateError } = await supabase
    .from("outreach_send_attempts")
    .update({
      status: "FAILED",
      retryable: result.retryable,
      error_code: result.errorCode,
      error_message: result.errorMessage,
      completed_at: completedAt,
    })
    .eq("id", attempt.id)
    .eq("status", "PENDING")
    .select()
    .single()
  if (attemptUpdateError || !failedAttempt) {
    throw new Error(`Failed to record failed send: ${attemptUpdateError?.message ?? "attempt row missing"}`)
  }

  const { data: failedDraft, error: draftUpdateError } = await supabase
    .from("outreach_drafts")
    .update({ status: "FAILED" })
    .eq("id", draftId)
    .eq("status", "SENDING")
    .select()
    .single()
  if (draftUpdateError || !failedDraft) {
    throw new Error(`Failed to update draft status after failed send: ${draftUpdateError?.message ?? "draft row missing"}`)
  }

  await logActivity(supabase, {
    entityType: "business",
    entityId: business.id,
    activityType: "OUTREACH_SEND_FAILED",
    description: `${draft.channel} message to ${business.name} failed: ${result.errorMessage}`,
    actorId,
    metadata: {
      draft_id: draft.id,
      send_attempt_id: failedAttempt.id,
      channel: draft.channel,
      provider: provider.providerName,
      error_code: result.errorCode,
      retryable: result.retryable,
    },
  })

  return { outcome: "FAILED", draft: failedDraft, sendAttempt: failedAttempt }
}

// Retrying reuses sendOutreachMessage entirely rather than duplicating
// its state machine/idempotency logic - it only handles the
// FAILED -> READY_TO_SEND transition and the non-retryable guard (spec
// section 16: never blindly retry a structural failure - bad number, bad
// credentials, policy rejection - that will just fail identically again).
export async function retryOutreachSend(
  supabase: SupabaseClient<Database>,
  draftId: string,
  actorId: string
): Promise<SendOutcome> {
  const { data: draft, error: draftError } = await supabase.from("outreach_drafts").select("*").eq("id", draftId).single()
  if (draftError || !draft) return { outcome: "BLOCKED", reason: "This draft could not be found." }

  if (draft.status !== "FAILED") {
    return { outcome: "BLOCKED", reason: `Only a failed send can be retried (current status: ${draft.status}).` }
  }

  const { data: lastAttempt } = await supabase
    .from("outreach_send_attempts")
    .select("*")
    .eq("outreach_draft_id", draftId)
    .order("attempted_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastAttempt?.retryable === false) {
    return {
      outcome: "BLOCKED",
      reason:
        "The last attempt failed for a reason that needs a fix, not a retry (invalid recipient, template, or credentials) - edit the draft or check provider configuration.",
    }
  }

  const { data: reset, error: resetError } = await supabase
    .from("outreach_drafts")
    .update({ status: "READY_TO_SEND" })
    .eq("id", draftId)
    .eq("status", "FAILED")
    .select()
    .single()
  if (resetError || !reset) {
    return {
      outcome: "BLOCKED",
      reason: "This draft could not be prepared for retry - it may have changed state. Refresh and try again.",
    }
  }

  await logActivity(supabase, {
    entityType: "business",
    entityId: draft.business_id,
    activityType: "OUTREACH_RETRY",
    description: `Retrying ${draft.channel} send.`,
    actorId,
    metadata: { draft_id: draft.id, channel: draft.channel },
  })

  return sendOutreachMessage(supabase, draftId, actorId)
}

export async function listSendAttempts(
  supabase: SupabaseClient<Database>,
  businessId: string
): Promise<Tables<"outreach_send_attempts">[]> {
  const { data, error } = await supabase
    .from("outreach_send_attempts")
    .select("*")
    .eq("business_id", businessId)
    .order("attempted_at", { ascending: false })
  if (error) throw new Error(`Failed to load outreach send history: ${error.message}`)
  return data
}

export type SendAttemptWithBusiness = Tables<"outreach_send_attempts"> & { businessName: string }

// Cross-business history for the /outreach page (spec section 33/43) -
// listSendAttempts above stays scoped to one business for the prospect
// page. outreach_send_attempts doesn't store the business name itself
// (spec section 15: don't duplicate mutable data into the immutable
// record - only recipient_address/message_body/sender_identity are
// snapshotted because those are what must survive later edits), so it's
// joined in here.
export async function listAllSendAttempts(
  supabase: SupabaseClient<Database>,
  limit = 100
): Promise<SendAttemptWithBusiness[]> {
  const { data: attempts, error } = await supabase
    .from("outreach_send_attempts")
    .select("*")
    .order("attempted_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(`Failed to load outreach send history: ${error.message}`)
  if (attempts.length === 0) return []

  const businessIds = [...new Set(attempts.map((a) => a.business_id))]
  const { data: businesses, error: businessError } = await supabase
    .from("businesses")
    .select("id, name")
    .in("id", businessIds)
  if (businessError) throw new Error(`Failed to load businesses for send history: ${businessError.message}`)

  const nameById = new Map(businesses.map((b) => [b.id, b.name]))
  return attempts.map((a) => ({ ...a, businessName: nameById.get(a.business_id) ?? "Unknown business" }))
}
