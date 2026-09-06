"use server"

import { revalidatePath } from "next/cache"

import { requireUser } from "@/lib/dal"
import { createClient } from "@/lib/supabase/server"
import { getAIProvider, AIError } from "@/lib/ai"
import { classifyInboundMessage } from "@/lib/services/response-classification-service"
import { logActivity } from "@/lib/services/activity-service"
import { findOrCreateConversation } from "@/lib/services/response-matching-service"
import { generateResponseDraft } from "@/lib/services/response-draft-service"

export type ActionState = { error?: string; success?: string } | null

// Shared by generateResponseDraftAction/regenerateResponseDraftAction -
// forceRegenerate is the only difference, matching the same
// generate/regenerate pattern app/actions/outreach.ts uses for
// cold-outreach drafts. Only ever reachable from an explicit button
// click in the UI - never called from the webhook/classification path,
// so no reply is ever drafted (let alone sent) without a human asking
// for one (spec section 27).
async function runGenerateResponseDraft(
  conversationId: string,
  actorId: string,
  forceRegenerate: boolean
): Promise<ActionState> {
  try {
    const ai = getAIProvider()
    const supabase = await createClient()
    const result = await generateResponseDraft(supabase, ai, conversationId, actorId, forceRegenerate)

    switch (result.outcome) {
      case "BLOCKED":
        return { error: result.reason }
      case "REUSED":
        return { success: `Showing the existing response draft${result.drafts.length === 1 ? "" : "s"} for this message - use Regenerate for a fresh one.` }
      case "GENERATED":
        return { success: `${result.drafts.length} response draft${result.drafts.length === 1 ? "" : "s"} generated. Review before approving.` }
    }
  } catch (err) {
    if (err instanceof AIError) return { error: err.message }
    return { error: err instanceof Error ? err.message : "Failed to generate a response draft." }
  } finally {
    revalidatePath(`/responses/${conversationId}`)
    revalidatePath("/responses")
  }
}

export async function generateResponseDraftAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser()
  const conversationId = formData.get("conversation_id")
  if (typeof conversationId !== "string") return { error: "Missing conversation." }
  return runGenerateResponseDraft(conversationId, user.id, false)
}

export async function regenerateResponseDraftAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser()
  const conversationId = formData.get("conversation_id")
  if (typeof conversationId !== "string") return { error: "Missing conversation." }
  return runGenerateResponseDraft(conversationId, user.id, true)
}

export async function markConversationReviewedAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser()
  const conversationId = formData.get("conversation_id")
  if (typeof conversationId !== "string") return { error: "Missing conversation." }

  try {
    const supabase = await createClient()
    const { error } = await supabase.from("conversations").update({ unread_count: 0 }).eq("id", conversationId)
    if (error) throw new Error(error.message)
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update conversation." }
  }

  revalidatePath("/responses")
  return { success: "Marked reviewed." }
}

export async function closeConversationAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser()
  const conversationId = formData.get("conversation_id")
  if (typeof conversationId !== "string") return { error: "Missing conversation." }

  try {
    const supabase = await createClient()
    const { data: conversation, error } = await supabase
      .from("conversations")
      .update({ status: "CLOSED" })
      .eq("id", conversationId)
      .select()
      .single()
    if (error) throw new Error(error.message)

    await logActivity(supabase, {
      entityType: "business",
      entityId: conversation.business_id,
      activityType: "CONVERSATION_CLOSED",
      description: "Conversation manually closed.",
      actorId: user.id,
      metadata: { conversation_id: conversation.id },
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to close conversation." }
  }

  revalidatePath("/responses")
  revalidatePath(`/responses/${conversationId}`)
  return { success: "Conversation closed." }
}

export async function reopenConversationAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser()
  const conversationId = formData.get("conversation_id")
  if (typeof conversationId !== "string") return { error: "Missing conversation." }

  try {
    const supabase = await createClient()
    const { data: existing, error: fetchError } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .single()
    if (fetchError) throw new Error(fetchError.message)
    if (existing.status === "DO_NOT_CONTACT") {
      return { error: "This business is marked Do Not Contact - remove that first from the prospect page." }
    }

    const { data: conversation, error } = await supabase
      .from("conversations")
      .update({ status: "OPEN" })
      .eq("id", conversationId)
      .select()
      .single()
    if (error) throw new Error(error.message)

    await logActivity(supabase, {
      entityType: "business",
      entityId: conversation.business_id,
      activityType: "CONVERSATION_REOPENED",
      description: "Conversation manually reopened.",
      actorId: user.id,
      metadata: { conversation_id: conversation.id },
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to reopen conversation." }
  }

  revalidatePath("/responses")
  revalidatePath(`/responses/${conversationId}`)
  return { success: "Conversation reopened." }
}

// Not a send - this is for a reply the human composed and sent outside
// the app (e.g. directly in WhatsApp on their phone) and wants reflected
// here so the conversation state stays accurate. No message content,
// no provider call - purely a status/bookkeeping update, so it carries
// none of the risk a real send would (spec section 24's human workflow
// still ends with the human deciding what to do; this just lets them
// record that they already did it).
export async function markRepliedOutsideAppAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser()
  const conversationId = formData.get("conversation_id")
  if (typeof conversationId !== "string") return { error: "Missing conversation." }

  try {
    const supabase = await createClient()
    const now = new Date().toISOString()
    const { data: conversation, error } = await supabase
      .from("conversations")
      .update({ status: "WAITING_FOR_THEM", last_outbound_at: now, last_message_at: now })
      .eq("id", conversationId)
      .select()
      .single()
    if (error) throw new Error(error.message)

    await logActivity(supabase, {
      entityType: "business",
      entityId: conversation.business_id,
      activityType: "RESPONSE_REVIEWED",
      description: "Marked as replied outside the app.",
      actorId: user.id,
      metadata: { conversation_id: conversation.id },
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update conversation." }
  }

  revalidatePath("/responses")
  revalidatePath(`/responses/${conversationId}`)
  return { success: "Marked as replied." }
}

export async function reclassifyMessageAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser()
  const messageId = formData.get("message_id")
  const conversationId = formData.get("conversation_id")
  if (typeof messageId !== "string") return { error: "Missing message." }

  try {
    const supabase = await createClient()
    const ai = getAIProvider()
    const { data: message, error } = await supabase.from("inbound_messages").select("*").eq("id", messageId).single()
    if (error || !message) throw new Error(error?.message ?? "Message not found.")
    await classifyInboundMessage(supabase, ai, message)
  } catch (err) {
    if (err instanceof AIError) return { error: err.message }
    return { error: err instanceof Error ? err.message : "Failed to reclassify message." }
  }

  revalidatePath("/responses")
  if (typeof conversationId === "string") revalidatePath(`/responses/${conversationId}`)
  return { success: "Reclassified." }
}

// Human-only resolution for an unmatched inbound message (spec section
// 9/11): the system never guesses which business a message belongs to,
// so a human must explicitly pick one before it's attached anywhere.
export async function assignUnmatchedMessageAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser()
  const messageId = formData.get("message_id")
  const businessId = formData.get("business_id")
  if (typeof messageId !== "string" || typeof businessId !== "string" || businessId.trim().length === 0) {
    return { error: "Choose a business to assign this message to." }
  }

  try {
    const supabase = await createClient()
    const { data: message, error: fetchError } = await supabase
      .from("inbound_messages")
      .select("*")
      .eq("id", messageId)
      .single()
    if (fetchError || !message) throw new Error(fetchError?.message ?? "Message not found.")

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .single()
    if (businessError || !business) throw new Error("Business not found.")

    const conversation = await findOrCreateConversation(supabase, business.id, null, message.channel, message.provider)

    const { error: updateError } = await supabase
      .from("inbound_messages")
      .update({ business_id: business.id, conversation_id: conversation.id, processing_status: "MATCHED" })
      .eq("id", messageId)
    if (updateError) throw new Error(updateError.message)

    const nextStatus = conversation.status === "DO_NOT_CONTACT" ? "DO_NOT_CONTACT" : "WAITING_FOR_US"
    await supabase
      .from("conversations")
      .update({
        status: nextStatus,
        last_message_at: message.received_at,
        last_inbound_at: message.received_at,
        unread_count: conversation.unread_count + 1,
      })
      .eq("id", conversation.id)

    await logActivity(supabase, {
      entityType: "business",
      entityId: business.id,
      activityType: "RESPONSE_RECEIVED",
      description: `An unmatched ${message.channel} message was manually assigned to ${business.name}.`,
      actorId: user.id,
      metadata: { conversation_id: conversation.id, inbound_message_id: message.id },
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to assign message." }
  }

  revalidatePath("/responses")
  return { success: "Message assigned." }
}
