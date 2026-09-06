"use server"

import { revalidatePath } from "next/cache"

import { requireUser } from "@/lib/dal"
import { createClient } from "@/lib/supabase/server"
import { getAIProvider, AIError } from "@/lib/ai"
import { generateSalesStrategy } from "@/lib/services/sales-strategy-service"
import {
  generateOutreachDrafts,
  editOutreachDraft,
  approveOutreachDraft,
  rejectOutreachDraft,
} from "@/lib/services/outreach-draft-service"
import { sendOutreachMessage, retryOutreachSend } from "@/lib/services/outreach-send-service"
import { setDoNotContact, clearDoNotContact } from "@/lib/services/business-service"

export type ActionState = { error?: string; success?: string } | null

// A response draft (Phase 6.1) is an outreach_drafts row like any other,
// edited/approved/sent through these same actions - so a change to one
// must also refresh the conversation page it's shown on, not just the
// prospect page these actions were originally written for. conversationId
// comes from the draft row itself (already reloaded server-side by the
// service call above each use), never from client input.
function revalidateForDraft(businessId: string, conversationId: string | null) {
  revalidatePath(`/prospects/${businessId}`)
  if (conversationId) {
    revalidatePath(`/responses/${conversationId}`)
    revalidatePath("/responses")
  }
}

// Shared by generateOutreachAction/regenerateOutreachAction - the only
// difference between them is forceRegenerate, so this is the single
// place implementing the section 22 workflow: load evidence -> generate
// strategy (which itself selects the primary opportunity/contact/channel
// deterministically) -> generate drafts for that channel only -> never
// send anything.
async function runGenerateOutreach(
  businessId: string,
  actorId: string,
  forceRegenerate: boolean
): Promise<ActionState> {
  try {
    const ai = getAIProvider()
    const supabase = await createClient()

    const strategyResult = await generateSalesStrategy(supabase, ai, businessId, actorId)

    if (strategyResult.channelSelection.channel === "NONE") {
      revalidatePath(`/prospects/${businessId}`)
      return {
        success:
          "Sales strategy generated. No usable contact channel is available (no WhatsApp or email on file), so no message drafts were generated.",
      }
    }

    const draftsResult = await generateOutreachDrafts(
      supabase,
      ai,
      {
        business: strategyResult.business,
        contact: strategyResult.contactSelection.contact,
        strategy: strategyResult.strategy,
        opportunity: strategyResult.primaryOpportunity,
      },
      actorId,
      forceRegenerate
    )

    revalidatePath(`/prospects/${businessId}`)
    return {
      success: `Sales strategy generated${strategyResult.wasSuperseded ? " (replacing a prior one)" : ""}. ${
        draftsResult.reused
          ? `Reused ${draftsResult.drafts.length} existing draft(s) - use Regenerate for fresh ones.`
          : `${draftsResult.drafts.length} draft(s) generated for ${strategyResult.channelSelection.channel}.`
      }`,
    }
  } catch (err) {
    if (err instanceof AIError) return { error: err.message }
    return { error: err instanceof Error ? err.message : "Failed to generate outreach." }
  }
}

export async function generateOutreachAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser()
  const businessId = formData.get("business_id")
  if (typeof businessId !== "string") return { error: "Missing business." }
  return runGenerateOutreach(businessId, user.id, false)
}

export async function regenerateOutreachAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser()
  const businessId = formData.get("business_id")
  if (typeof businessId !== "string") return { error: "Missing business." }
  return runGenerateOutreach(businessId, user.id, true)
}

export async function editOutreachDraftAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser()
  const draftId = formData.get("draft_id")
  const businessId = formData.get("business_id")
  const subject = formData.get("subject")
  const body = formData.get("body")
  if (
    typeof draftId !== "string" ||
    typeof businessId !== "string" ||
    typeof body !== "string" ||
    body.trim().length === 0
  ) {
    return { error: "Invalid edit - the message body cannot be empty." }
  }

  try {
    const supabase = await createClient()
    const updated = await editOutreachDraft(
      supabase,
      draftId,
      { subject: typeof subject === "string" && subject.trim().length > 0 ? subject : null, body },
      user.id
    )
    revalidateForDraft(businessId, updated.conversation_id)
  } catch (err) {
    revalidatePath(`/prospects/${businessId}`)
    return { error: err instanceof Error ? err.message : "Failed to update draft." }
  }

  return { success: "Draft updated and re-validated." }
}

export async function approveOutreachDraftAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser()
  const draftId = formData.get("draft_id")
  const businessId = formData.get("business_id")
  if (typeof draftId !== "string" || typeof businessId !== "string") return { error: "Missing draft." }

  try {
    const supabase = await createClient()
    const updated = await approveOutreachDraft(supabase, draftId, user.id)
    revalidateForDraft(businessId, updated.conversation_id)
  } catch (err) {
    revalidatePath(`/prospects/${businessId}`)
    return { error: err instanceof Error ? err.message : "Failed to approve draft." }
  }

  return { success: "Draft approved and marked ready to send. Nothing has been sent yet - review it and click Send when ready." }
}

export async function rejectOutreachDraftAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser()
  const draftId = formData.get("draft_id")
  const businessId = formData.get("business_id")
  if (typeof draftId !== "string" || typeof businessId !== "string") return { error: "Missing draft." }

  try {
    const supabase = await createClient()
    const updated = await rejectOutreachDraft(supabase, draftId, user.id)
    revalidateForDraft(businessId, updated.conversation_id)
  } catch (err) {
    revalidatePath(`/prospects/${businessId}`)
    return { error: err instanceof Error ? err.message : "Failed to reject draft." }
  }

  return { success: "Draft rejected." }
}

// Never trusts the client for anything beyond "which draft" - the
// message, recipient, and approval state are all re-loaded and
// re-verified server-side inside sendOutreachMessage (spec section 40).
function describeSendOutcome(
  outcome: Awaited<ReturnType<typeof sendOutreachMessage>>
): ActionState {
  switch (outcome.outcome) {
    case "SENT":
      return {
        success: `Message sent via ${outcome.draft.channel}. Provider message ID: ${outcome.sendAttempt.provider_message_id ?? "unknown"}.`,
      }
    case "ALREADY_SENT":
      return { success: "This message was already sent - no duplicate was sent." }
    case "FAILED":
      return { error: outcome.sendAttempt.error_message ?? "The message could not be sent." }
    case "BLOCKED":
      return { error: outcome.reason }
  }
}

export async function sendOutreachDraftAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser()
  const draftId = formData.get("draft_id")
  const businessId = formData.get("business_id")
  if (typeof draftId !== "string" || typeof businessId !== "string") return { error: "Missing draft." }

  let result: ActionState
  try {
    const supabase = await createClient()
    const outcome = await sendOutreachMessage(supabase, draftId, user.id)
    result = describeSendOutcome(outcome)
    revalidateForDraft(businessId, outcome.outcome === "BLOCKED" ? null : outcome.draft.conversation_id)
  } catch (err) {
    revalidatePath(`/prospects/${businessId}`)
    result = { error: err instanceof Error ? err.message : "Failed to send message." }
  }

  return result
}

export async function retryOutreachSendAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser()
  const draftId = formData.get("draft_id")
  const businessId = formData.get("business_id")
  if (typeof draftId !== "string" || typeof businessId !== "string") return { error: "Missing draft." }

  let result: ActionState
  try {
    const supabase = await createClient()
    const outcome = await retryOutreachSend(supabase, draftId, user.id)
    result = describeSendOutcome(outcome)
    revalidateForDraft(businessId, outcome.outcome === "BLOCKED" ? null : outcome.draft.conversation_id)
  } catch (err) {
    revalidatePath(`/prospects/${businessId}`)
    result = { error: err instanceof Error ? err.message : "Failed to retry send." }
  }

  return result
}

export async function setDoNotContactAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser()
  const businessId = formData.get("business_id")
  const reason = formData.get("reason")
  if (typeof businessId !== "string") return { error: "Missing business." }

  try {
    const supabase = await createClient()
    await setDoNotContact(supabase, businessId, typeof reason === "string" && reason.trim().length > 0 ? reason : null, user.id)
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update contact preference." }
  }

  revalidatePath(`/prospects/${businessId}`)
  return { success: "Business marked Do Not Contact. All future sends to it will be blocked." }
}

export async function clearDoNotContactAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser()
  const businessId = formData.get("business_id")
  if (typeof businessId !== "string") return { error: "Missing business." }

  try {
    const supabase = await createClient()
    await clearDoNotContact(supabase, businessId, user.id)
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update contact preference." }
  }

  revalidatePath(`/prospects/${businessId}`)
  return { success: "Do Not Contact removed for this business." }
}
