import { describe, expect, it } from "vitest"

import { LeadScoreOutputSchema } from "./ai-lead-score"

const validReasoning = {
  industry_fit: "Fits well",
  digital_problems: "Several",
  missing_functionality: "No booking",
  business_potential: "Moderate",
  contactability: "Phone and email available",
  growth_potential: "High",
  other: "None",
}

const valid = {
  industry_fit_score: 15,
  digital_problems_score: 15,
  missing_functionality_score: 15,
  business_potential_score: 10,
  contactability_score: 8,
  growth_potential_score: 8,
  other_score: 3,
  reasoning: validReasoning,
  confidence: 0.8,
}

describe("LeadScoreOutputSchema", () => {
  it("accepts a valid score", () => {
    expect(LeadScoreOutputSchema.safeParse(valid).success).toBe(true)
  })

  it("rejects a component score above its max (industry_fit_score > 20)", () => {
    const result = LeadScoreOutputSchema.safeParse({ ...valid, industry_fit_score: 25 })
    expect(result.success).toBe(false)
  })

  it("rejects a component score above its max (other_score > 5)", () => {
    const result = LeadScoreOutputSchema.safeParse({ ...valid, other_score: 6 })
    expect(result.success).toBe(false)
  })

  it("rejects a negative component score", () => {
    const result = LeadScoreOutputSchema.safeParse({ ...valid, contactability_score: -1 })
    expect(result.success).toBe(false)
  })

  it("rejects a non-integer component score", () => {
    const result = LeadScoreOutputSchema.safeParse({ ...valid, growth_potential_score: 5.5 })
    expect(result.success).toBe(false)
  })

  it("rejects confidence outside 0-1", () => {
    const result = LeadScoreOutputSchema.safeParse({ ...valid, confidence: 1.5 })
    expect(result.success).toBe(false)
  })

  it("rejects a missing reasoning field", () => {
    const incompleteReasoning = {
      digital_problems: "Several",
      missing_functionality: "No booking",
      business_potential: "Moderate",
      contactability: "Phone and email available",
      growth_potential: "High",
      other: "None",
    }
    const result = LeadScoreOutputSchema.safeParse({ ...valid, reasoning: incompleteReasoning })
    expect(result.success).toBe(false)
  })
})
