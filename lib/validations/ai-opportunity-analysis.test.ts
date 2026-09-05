import { describe, expect, it } from "vitest"

import { IdentifiedOpportunitySchema, OpportunityAnalysisOutputSchema } from "./ai-opportunity-analysis"

const validReasoning = {
  business_impact: "x",
  evidence_strength: "x",
  customer_need: "x",
  commercial_fit: "x",
  urgency: "x",
  feasibility: "x",
}

const validOpportunity = {
  opportunity_type: "WEBSITE_REDESIGN",
  title: "Outdated website",
  description: "The website has not been updated in years.",
  problem: "No online booking, stale content.",
  evidence: "Homepage copyright year reads 2019; no booking form found.",
  proposed_solution: "Rebuild the site with a modern CMS and booking integration.",
  recommended_service: "Website redesign with booking system",
  expected_benefit: "Customers can book online instead of calling, reducing missed bookings.",
  estimated_complexity: "MEDIUM",
  confidence: 0.7,
  business_impact_score: 20,
  evidence_strength_score: 15,
  customer_need_score: 10,
  commercial_fit_score: 10,
  urgency_score: 5,
  feasibility_score: 10,
  reasoning: validReasoning,
}

describe("IdentifiedOpportunitySchema", () => {
  it("accepts a valid opportunity", () => {
    expect(IdentifiedOpportunitySchema.safeParse(validOpportunity).success).toBe(true)
  })

  it("rejects business_impact_score above its max of 25", () => {
    const result = IdentifiedOpportunitySchema.safeParse({ ...validOpportunity, business_impact_score: 26 })
    expect(result.success).toBe(false)
  })

  it("rejects urgency_score above its max of 10", () => {
    const result = IdentifiedOpportunitySchema.safeParse({ ...validOpportunity, urgency_score: 11 })
    expect(result.success).toBe(false)
  })

  it("rejects a negative component score", () => {
    const result = IdentifiedOpportunitySchema.safeParse({ ...validOpportunity, feasibility_score: -1 })
    expect(result.success).toBe(false)
  })

  it("rejects an invalid opportunity_type", () => {
    const result = IdentifiedOpportunitySchema.safeParse({ ...validOpportunity, opportunity_type: "NOT_A_TYPE" })
    expect(result.success).toBe(false)
  })

  it("rejects an invalid estimated_complexity", () => {
    const result = IdentifiedOpportunitySchema.safeParse({ ...validOpportunity, estimated_complexity: "EXTREME" })
    expect(result.success).toBe(false)
  })

  it("rejects a missing reasoning field", () => {
    const incompleteReasoning: Record<string, unknown> = { ...validReasoning }
    delete incompleteReasoning.feasibility
    const result = IdentifiedOpportunitySchema.safeParse({ ...validOpportunity, reasoning: incompleteReasoning })
    expect(result.success).toBe(false)
  })
})

describe("OpportunityAnalysisOutputSchema", () => {
  it("accepts an empty opportunities array", () => {
    expect(OpportunityAnalysisOutputSchema.safeParse({ opportunities: [] }).success).toBe(true)
  })

  it("accepts multiple valid opportunities", () => {
    const result = OpportunityAnalysisOutputSchema.safeParse({
      opportunities: [validOpportunity, validOpportunity],
    })
    expect(result.success).toBe(true)
  })
})
