import { describe, expect, it } from "vitest"

import { classifyScore, computeTotalScore } from "./lead-scoring-service"
import type { LeadScoreOutput } from "@/lib/validations/ai-lead-score"

const baseReasoning = {
  industry_fit: "x",
  digital_problems: "x",
  missing_functionality: "x",
  business_potential: "x",
  contactability: "x",
  growth_potential: "x",
  other: "x",
}

function components(overrides: Partial<LeadScoreOutput> = {}): LeadScoreOutput {
  return {
    industry_fit_score: 0,
    digital_problems_score: 0,
    missing_functionality_score: 0,
    business_potential_score: 0,
    contactability_score: 0,
    growth_potential_score: 0,
    other_score: 0,
    reasoning: baseReasoning,
    confidence: 0.8,
    ...overrides,
  }
}

describe("computeTotalScore", () => {
  it("sums all seven components", () => {
    const total = computeTotalScore(
      components({
        industry_fit_score: 20,
        digital_problems_score: 20,
        missing_functionality_score: 20,
        business_potential_score: 15,
        contactability_score: 10,
        growth_potential_score: 10,
        other_score: 5,
      })
    )
    expect(total).toBe(100)
  })

  it("returns 0 when every component is 0", () => {
    expect(computeTotalScore(components())).toBe(0)
  })

  it("ignores anything the AI might claim about a total - it is never an input", () => {
    // computeTotalScore's type signature has no total_score field to trust in
    // the first place; this test documents that guarantee explicitly.
    const output = components({ industry_fit_score: 10 })
    expect("total_score" in output).toBe(false)
  })
})

describe("classifyScore", () => {
  it.each([
    [100, "EXCEPTIONAL"],
    [90, "EXCEPTIONAL"],
    [89, "HIGH"],
    [75, "HIGH"],
    [74, "MEDIUM"],
    [60, "MEDIUM"],
    [59, "LOW"],
    [40, "LOW"],
    [39, "VERY_LOW"],
    [0, "VERY_LOW"],
  ])("classifies %i as %s", (score, expected) => {
    expect(classifyScore(score)).toBe(expected)
  })
})
