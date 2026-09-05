import { describe, expect, it } from "vitest"

import { BusinessResearchOutputSchema } from "./ai-business-research"

const valid = {
  observations: [{ fact: "Website exists", source_url: "https://example.com" }],
  inferences: [{ inference: "Likely a small business", basis: "Single-page site with no team page" }],
  recommendations: [{ recommendation: "Build a booking system", rationale: "No booking flow found" }],
  digital_presence: {
    has_website: true,
    has_online_booking: false,
    has_ecommerce: false,
    has_customer_portal: false,
    has_mobile_app: false,
    has_online_forms: true,
    social_platforms: ["Facebook"],
  },
  proposed_opportunities: [
    {
      opportunity_type: "BOOKING_SYSTEM",
      title: "Online booking",
      description: "Add booking",
      problem: "No booking",
      proposed_solution: "Build one",
      priority: "HIGH",
      confidence: 0.7,
    },
  ],
  confidence: 0.75,
}

describe("BusinessResearchOutputSchema", () => {
  it("accepts a valid research output", () => {
    expect(BusinessResearchOutputSchema.safeParse(valid).success).toBe(true)
  })

  it("accepts empty arrays (nothing found is a valid outcome)", () => {
    const result = BusinessResearchOutputSchema.safeParse({
      ...valid,
      observations: [],
      inferences: [],
      recommendations: [],
      proposed_opportunities: [],
    })
    expect(result.success).toBe(true)
  })

  it("rejects an unknown opportunity_type", () => {
    const result = BusinessResearchOutputSchema.safeParse({
      ...valid,
      proposed_opportunities: [{ ...valid.proposed_opportunities[0], opportunity_type: "NOT_REAL" }],
    })
    expect(result.success).toBe(false)
  })

  it("rejects an inference missing its basis", () => {
    const result = BusinessResearchOutputSchema.safeParse({
      ...valid,
      inferences: [{ inference: "Something" }],
    })
    expect(result.success).toBe(false)
  })

  it("rejects confidence outside 0-1", () => {
    const result = BusinessResearchOutputSchema.safeParse({ ...valid, confidence: 2 })
    expect(result.success).toBe(false)
  })
})
