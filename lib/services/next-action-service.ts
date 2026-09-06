import type { Enums } from "@/lib/types/database.types"
import type { BusinessDetail } from "@/lib/services/business-service"

// Fixed vocabulary only - the prospect page renders a label per action,
// never freeform AI text, so a recommendation can never turn into
// something that looks like an instruction to contact someone
// automatically. Nothing in this module sends anything; it only
// recommends what a human should consider doing next.
export type NextAction =
  | "RESEARCH_BUSINESS"
  | "AUDIT_WEBSITE"
  | "SCORE_LEAD"
  | "REVIEW_OPPORTUNITY"
  | "ADD_CONTACT"
  | "PREPARE_OUTREACH"
  | "FOLLOW_UP"
  | "RESPOND_TO_PROSPECT"
  | "SCHEDULE_MEETING"
  | "SEND_PROPOSAL"
  | "NO_ACTION"

export type NextActionRecommendation = {
  action: NextAction
  reason: string
}

export type NextActionInput = {
  pipelineStatus: Enums<"pipeline_status">
  hasResearch: boolean
  hasWebsite: boolean
  hasAudit: boolean
  hasLeadScore: boolean
  hasContact: boolean
  hasQualifiedOpportunity: boolean
  topOpportunity: {
    title: string
    priority: Enums<"opportunity_priority">
  } | null
  /** A conversation is waiting on a human reply (spec section 15/17) - takes priority over the data-gathering pipeline. */
  needsResponse: boolean
}

// Pure decision tree, not an AI call - deterministic and unit-testable so
// the recommendation can never drift from what's actually on file, and
// never requires an AI request just to render the prospect page. Checked
// in priority order: data-gathering gaps first, then the highest-priority
// open opportunity, then pipeline-stage guidance.
export function determineNextAction(input: NextActionInput): NextActionRecommendation {
  if (input.pipelineStatus === "WON" || input.pipelineStatus === "LOST") {
    return {
      action: "NO_ACTION",
      reason: `This prospect is already ${input.pipelineStatus.toLowerCase()} - no further action recommended.`,
    }
  }
  if (input.needsResponse) {
    return {
      action: "RESPOND_TO_PROSPECT",
      reason: "This prospect replied and is waiting on a response - review the conversation before anything else.",
    }
  }
  if (!input.hasResearch) {
    return {
      action: "RESEARCH_BUSINESS",
      reason: "No research has been recorded yet - run Research first to gather observations.",
    }
  }
  if (input.hasWebsite && !input.hasAudit) {
    return {
      action: "AUDIT_WEBSITE",
      reason: "This business has a website that hasn't been audited yet - audit it to find concrete opportunities.",
    }
  }
  if (!input.hasLeadScore) {
    return {
      action: "SCORE_LEAD",
      reason: "Research is on file but this business hasn't been scored yet.",
    }
  }
  if (input.topOpportunity) {
    return {
      action: "REVIEW_OPPORTUNITY",
      reason: `"${input.topOpportunity.title}" is a ${input.topOpportunity.priority} priority opportunity awaiting review - qualify it before reaching out.`,
    }
  }
  if (!input.hasContact && (input.pipelineStatus === "NEW" || input.pipelineStatus === "QUALIFIED")) {
    return {
      action: "ADD_CONTACT",
      reason: "No contact person is on file yet - add one before outreach can be prepared.",
    }
  }
  if (
    (input.pipelineStatus === "NEW" || input.pipelineStatus === "QUALIFIED") &&
    input.hasContact &&
    input.hasQualifiedOpportunity
  ) {
    return {
      action: "PREPARE_OUTREACH",
      reason:
        "A qualified opportunity and a contact are on file - prepare outreach. This system only recommends; it never sends messages automatically.",
    }
  }
  if (input.pipelineStatus === "CONTACTED") {
    return { action: "FOLLOW_UP", reason: "This prospect was contacted and hasn't replied yet - consider a manual follow-up." }
  }
  if (input.pipelineStatus === "REPLIED") {
    return { action: "SCHEDULE_MEETING", reason: "This prospect replied - schedule a meeting." }
  }
  if (input.pipelineStatus === "MEETING") {
    return { action: "SEND_PROPOSAL", reason: "A meeting was held - prepare and send a proposal." }
  }
  if (input.pipelineStatus === "PROPOSAL") {
    return { action: "NO_ACTION", reason: "A proposal was sent - waiting on the prospect's decision." }
  }
  return { action: "NO_ACTION", reason: "Nothing more to recommend automatically right now - use judgment for next steps." }
}

// Adapter from the aggregate BusinessDetail shape to the decision tree's
// flat input - keeps determineNextAction itself free of any dependency on
// how the data is fetched, so it stays trivially unit-testable.
// needsResponse comes from the caller (conversations aren't part of
// BusinessDetail) rather than being fetched in here - defaults to false
// so existing callers/tests that don't know about conversations yet are
// unaffected.
export function getNextAction(business: BusinessDetail, needsResponse = false): NextActionRecommendation {
  const topOpportunity =
    business.opportunities
      .filter((o) => o.status === "IDENTIFIED" && (o.priority === "CRITICAL" || o.priority === "HIGH"))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null

  return determineNextAction({
    pipelineStatus: business.pipeline_status,
    hasResearch: business.research_notes.length > 0,
    hasWebsite: !!business.website,
    hasAudit: business.audits.length > 0,
    hasLeadScore: business.lead_score !== null,
    hasContact: business.contacts.length > 0,
    needsResponse,
    hasQualifiedOpportunity: business.opportunities.some((o) => o.status === "QUALIFIED" || o.status === "ACCEPTED"),
    topOpportunity: topOpportunity ? { title: topOpportunity.title, priority: topOpportunity.priority } : null,
  })
}
