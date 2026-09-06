import { describe, expect, it } from "vitest"

import { determineNextAction, getNextAction, type NextActionInput } from "./next-action-service"
import type { BusinessDetail } from "./business-service"
import type { Tables } from "@/lib/types/database.types"

function input(overrides: Partial<NextActionInput> = {}): NextActionInput {
  return {
    pipelineStatus: "NEW",
    hasResearch: true,
    hasWebsite: false,
    hasAudit: true,
    hasLeadScore: true,
    hasContact: true,
    hasQualifiedOpportunity: false,
    topOpportunity: null,
    needsResponse: false,
    ...overrides,
  }
}

describe("determineNextAction", () => {
  it("recommends NO_ACTION when the prospect is WON", () => {
    expect(determineNextAction(input({ pipelineStatus: "WON" })).action).toBe("NO_ACTION")
  })

  it("recommends NO_ACTION when the prospect is LOST", () => {
    expect(determineNextAction(input({ pipelineStatus: "LOST" })).action).toBe("NO_ACTION")
  })

  it("recommends RESEARCH_BUSINESS when no research has been recorded, ahead of every other gap", () => {
    expect(determineNextAction(input({ hasResearch: false, hasLeadScore: false })).action).toBe("RESEARCH_BUSINESS")
  })

  it("recommends RESPOND_TO_PROSPECT when a conversation needs a response, ahead of everything except WON/LOST", () => {
    expect(determineNextAction(input({ needsResponse: true, hasResearch: false })).action).toBe("RESPOND_TO_PROSPECT")
  })

  it("does not recommend RESPOND_TO_PROSPECT once the prospect is WON or LOST", () => {
    expect(determineNextAction(input({ needsResponse: true, pipelineStatus: "WON" })).action).toBe("NO_ACTION")
  })

  it("recommends AUDIT_WEBSITE when a website exists but has never been audited", () => {
    expect(determineNextAction(input({ hasWebsite: true, hasAudit: false })).action).toBe("AUDIT_WEBSITE")
  })

  it("does not recommend AUDIT_WEBSITE when there is no website to audit", () => {
    expect(determineNextAction(input({ hasWebsite: false, hasAudit: false })).action).not.toBe("AUDIT_WEBSITE")
  })

  it("recommends SCORE_LEAD when research exists but no lead score yet", () => {
    expect(determineNextAction(input({ hasLeadScore: false })).action).toBe("SCORE_LEAD")
  })

  it("recommends REVIEW_OPPORTUNITY when a CRITICAL/HIGH opportunity is awaiting review, naming it", () => {
    const result = determineNextAction(input({ topOpportunity: { title: "No online booking", priority: "HIGH" } }))
    expect(result.action).toBe("REVIEW_OPPORTUNITY")
    expect(result.reason).toContain("No online booking")
  })

  it("recommends ADD_CONTACT when a NEW prospect has no contact on file", () => {
    expect(determineNextAction(input({ pipelineStatus: "NEW", hasContact: false })).action).toBe("ADD_CONTACT")
  })

  it("recommends ADD_CONTACT when a QUALIFIED prospect has no contact on file", () => {
    expect(determineNextAction(input({ pipelineStatus: "QUALIFIED", hasContact: false })).action).toBe("ADD_CONTACT")
  })

  it("recommends PREPARE_OUTREACH when a qualified opportunity and a contact are both on file, and says it never sends automatically", () => {
    const result = determineNextAction(
      input({ pipelineStatus: "QUALIFIED", hasContact: true, hasQualifiedOpportunity: true })
    )
    expect(result.action).toBe("PREPARE_OUTREACH")
    expect(result.reason).toMatch(/never sends/i)
  })

  it("recommends FOLLOW_UP for a CONTACTED prospect", () => {
    expect(determineNextAction(input({ pipelineStatus: "CONTACTED" })).action).toBe("FOLLOW_UP")
  })

  it("recommends SCHEDULE_MEETING for a REPLIED prospect", () => {
    expect(determineNextAction(input({ pipelineStatus: "REPLIED" })).action).toBe("SCHEDULE_MEETING")
  })

  it("recommends SEND_PROPOSAL for a MEETING-stage prospect", () => {
    expect(determineNextAction(input({ pipelineStatus: "MEETING" })).action).toBe("SEND_PROPOSAL")
  })

  it("recommends NO_ACTION (waiting on the prospect) for a PROPOSAL-stage prospect", () => {
    expect(determineNextAction(input({ pipelineStatus: "PROPOSAL" })).action).toBe("NO_ACTION")
  })

  it("falls back to NO_ACTION when a NEW prospect has everything on file but no qualified opportunity yet", () => {
    const result = determineNextAction(
      input({ pipelineStatus: "NEW", hasContact: true, hasQualifiedOpportunity: false })
    )
    expect(result.action).toBe("NO_ACTION")
  })
})

function business(overrides: Partial<Tables<"businesses">> = {}): Tables<"businesses"> {
  return {
    id: "biz-1",
    name: "Test Business",
    name_normalized: "test business",
    industry: null,
    description: null,
    location: null,
    city: null,
    country: null,
    website: null,
    website_normalized: null,
    phone: null,
    phone_normalized: null,
    whatsapp_number: null,
    whatsapp_status: "UNKNOWN",
    email: null,
    social_links: {},
    pipeline_status: "NEW",
    source: "manual",
    source_url: null,
    discovered_at: new Date().toISOString(),
    do_not_contact: false,
    do_not_contact_reason: null,
    do_not_contact_at: null,
    last_researched_at: null,
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function leadScore(overrides: Partial<Tables<"lead_scores">> = {}): Tables<"lead_scores"> {
  return {
    id: "score-1",
    business_id: "biz-1",
    industry_fit_score: 10,
    digital_problems_score: 10,
    missing_functionality_score: 10,
    business_potential_score: 10,
    contactability_score: 10,
    growth_potential_score: 10,
    other_score: 5,
    total_score: 65,
    classification: "HIGH",
    reasoning: {},
    confidence: 0.7,
    model: "fake-model",
    scored_by: null,
    scored_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function researchNote(overrides: Partial<Tables<"business_research_notes">> = {}): Tables<"business_research_notes"> {
  return {
    id: "note-1",
    business_id: "biz-1",
    observations: [],
    inferences: [],
    recommendations: [],
    digital_presence: {},
    source_urls: [],
    confidence: 0.7,
    model: "fake-model",
    researched_by: null,
    researched_at: new Date().toISOString(),
    ...overrides,
  }
}

function opportunity(overrides: Partial<Tables<"opportunities">> = {}): Tables<"opportunities"> {
  return {
    id: "opp-1",
    business_id: "biz-1",
    opportunity_type: "WEBSITE_REDESIGN",
    title: "Some opportunity",
    title_normalized: "some opportunity",
    description: null,
    problem: null,
    proposed_solution: null,
    evidence: null,
    recommended_service: null,
    expected_benefit: null,
    estimated_complexity: null,
    estimated_value: null,
    priority: "MEDIUM",
    status: "IDENTIFIED",
    confidence: null,
    source: "manual",
    score: null,
    business_impact_score: null,
    evidence_strength_score: null,
    customer_need_score: null,
    commercial_fit_score: null,
    urgency_score: null,
    feasibility_score: null,
    score_reasoning: {},
    audit_id: null,
    last_detected_at: new Date().toISOString(),
    times_detected: 1,
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function businessDetail(overrides: Partial<BusinessDetail> = {}): BusinessDetail {
  return {
    ...business(),
    lead_score: null,
    research_notes: [],
    opportunities: [],
    contacts: [],
    audits: [],
    ...overrides,
  }
}

describe("getNextAction", () => {
  it("recommends RESEARCH_BUSINESS for a brand new business with nothing on file", () => {
    expect(getNextAction(businessDetail()).action).toBe("RESEARCH_BUSINESS")
  })

  it("picks the highest-scored CRITICAL/HIGH IDENTIFIED opportunity, ignoring lower-scored, lower-priority, and already-qualified ones", () => {
    const detail = businessDetail({
      lead_score: leadScore(),
      research_notes: [researchNote()],
      opportunities: [
        opportunity({ id: "a", title: "Low-scoring", priority: "HIGH", status: "IDENTIFIED", score: 50 }),
        opportunity({ id: "b", title: "High-scoring", priority: "CRITICAL", status: "IDENTIFIED", score: 90 }),
        opportunity({ id: "c", title: "Already qualified", priority: "CRITICAL", status: "QUALIFIED", score: 95 }),
        opportunity({ id: "d", title: "Medium priority", priority: "MEDIUM", status: "IDENTIFIED", score: 99 }),
      ],
    })

    const result = getNextAction(detail)
    expect(result.action).toBe("REVIEW_OPPORTUNITY")
    expect(result.reason).toContain("High-scoring")
  })
})
