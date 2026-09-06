import type { Enums } from "@/lib/types/database.types"

export type RecommendedResponseAction = {
  action: string
  reason: string
}

// Pure, deterministic mapping from a classified intent to what a human
// should consider doing next - not an AI call (spec section 17: "Do not
// invent recommendations unrelated to the conversation"). The AI's job
// stops at classifying what the message actually says; this function
// decides what that means to do about it, the same split Phase 4 already
// established between AI-written narrative and deterministic scoring.
export function recommendResponseAction(
  intent: Enums<"response_intent">,
  opportunityService: string | null
): RecommendedResponseAction {
  const serviceRef = opportunityService ? ` (${opportunityService})` : ""
  switch (intent) {
    case "INTERESTED":
      return {
        action: "Explain the proposed solution and ask for a short discovery call",
        reason: `They've responded positively${serviceRef ? " to" : ""}${serviceRef} - a good moment to go one level deeper and offer a call.`,
      }
    case "QUESTION":
      return { action: "Reply to their question", reason: "They asked something specific - answer it directly before anything else." }
    case "REQUEST_FOR_PRICING":
      return { action: "Prepare and send pricing", reason: "They explicitly asked what this costs." }
    case "REQUEST_FOR_MEETING":
      return { action: "Schedule a meeting", reason: "They asked to meet or call - propose times." }
    case "OBJECTION":
      return { action: "Address the objection", reason: "They raised a concern - respond to it directly rather than pushing past it." }
    case "NOT_INTERESTED":
      return { action: "No action required", reason: "They indicated they're not interested right now." }
    case "WRONG_PERSON":
      return { action: "Find and contact the correct decision-maker", reason: "This isn't the right contact at the business." }
    case "OPT_OUT":
      return {
        action: "Do not contact",
        reason: "They asked not to be contacted again - this business has been suppressed automatically.",
      }
    case "POSITIVE_GENERAL":
      return { action: "Reply and clarify what specifically interests them", reason: "A generally positive reply without a specific ask yet." }
    case "NEGATIVE_GENERAL":
      return { action: "Review manually", reason: "A generally negative reply - read it yourself before deciding how to respond." }
    case "UNCLEAR":
      return { action: "Review manually", reason: "The intent behind this message isn't clear enough to recommend a specific action." }
  }
}
