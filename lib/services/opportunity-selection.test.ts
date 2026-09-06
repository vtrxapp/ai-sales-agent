import { describe, expect, it } from "vitest"

import { selectPrimaryOpportunity, resolveRecommendedService } from "./opportunity-selection"
import type { Tables } from "@/lib/types/database.types"

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

describe("selectPrimaryOpportunity", () => {
  it("picks the highest-scored active opportunity", () => {
    const low = opportunity({ id: "low", score: 40 })
    const high = opportunity({ id: "high", score: 90 })
    const result = selectPrimaryOpportunity([low, high])
    expect(result.primary?.id).toBe("high")
    expect(result.secondary.map((o) => o.id)).toEqual(["low"])
  })

  it("excludes REJECTED and CLOSED opportunities entirely", () => {
    const rejected = opportunity({ id: "rejected", score: 99, status: "REJECTED" })
    const closed = opportunity({ id: "closed", score: 95, status: "CLOSED" })
    const active = opportunity({ id: "active", score: 10, status: "IDENTIFIED" })
    const result = selectPrimaryOpportunity([rejected, closed, active])
    expect(result.primary?.id).toBe("active")
  })

  it("breaks ties on business_impact_score, then evidence_strength_score", () => {
    const a = opportunity({ id: "a", score: 70, business_impact_score: 10, evidence_strength_score: 20 })
    const b = opportunity({ id: "b", score: 70, business_impact_score: 15, evidence_strength_score: 5 })
    const result = selectPrimaryOpportunity([a, b])
    expect(result.primary?.id).toBe("b")
  })

  it("sorts unscored opportunities last", () => {
    const scored = opportunity({ id: "scored", score: 10 })
    const unscored = opportunity({ id: "unscored", score: null })
    const result = selectPrimaryOpportunity([unscored, scored])
    expect(result.primary?.id).toBe("scored")
  })

  it("returns null primary when there are no active opportunities", () => {
    const result = selectPrimaryOpportunity([opportunity({ status: "CLOSED" })])
    expect(result.primary).toBeNull()
    expect(result.secondary).toEqual([])
  })

  it("returns at most 2 secondary opportunities", () => {
    const opps = [90, 80, 70, 60].map((score, i) => opportunity({ id: `o${i}`, score }))
    const result = selectPrimaryOpportunity(opps)
    expect(result.secondary).toHaveLength(2)
  })
})

describe("resolveRecommendedService", () => {
  it("uses the opportunity's own recommended_service when set", () => {
    const result = resolveRecommendedService(opportunity({ recommended_service: "Custom booking flow" }))
    expect(result).toBe("Custom booking flow")
  })

  it("falls back to a humanized opportunity_type when recommended_service is unset", () => {
    const result = resolveRecommendedService(opportunity({ recommended_service: null, opportunity_type: "BOOKING_SYSTEM" }))
    expect(result).toBe("Booking System")
  })

  it("falls back to a humanized opportunity_type when recommended_service is blank", () => {
    const result = resolveRecommendedService(opportunity({ recommended_service: "   ", opportunity_type: "MOBILE_APP" }))
    expect(result).toBe("Mobile App")
  })

  it("returns NO_MATCHING_SERVICE rather than inventing a service when nothing usable exists", () => {
    const result = resolveRecommendedService(opportunity({ recommended_service: null, opportunity_type: "OTHER" }))
    expect(result).toBe("NO_MATCHING_SERVICE")
  })
})
