import { describe, expect, it } from "vitest"

import { SalesStrategyOutputSchema } from "./ai-sales-strategy"

const valid = {
  primary_problem: "No online booking flow is visible on the website.",
  supporting_evidence: "The homepage and services page have no booking form or link to one.",
  evidence_type: "OBSERVED",
  why_it_matters: "Customers must call to book, which may lose bookings outside business hours.",
  recommended_solution: "Add an online booking system integrated with the existing website.",
  expected_business_benefit: "Customers could book anytime, potentially reducing missed enquiries.",
  sales_angle: "Make class registration easier without relying entirely on manual messaging.",
  value_proposition: "A simple booking flow could reduce back-and-forth phone calls.",
  contact_reason: "This contact is the business's general manager and likely handles digital decisions.",
  opening_strategy: "Open by referencing the missing booking flow directly.",
  objection_considerations: ["May already be planning a website refresh internally."],
  things_to_avoid: ["Do not claim a specific percentage increase in bookings."],
  confidence: 0.75,
}

describe("SalesStrategyOutputSchema", () => {
  it("accepts a valid strategy", () => {
    expect(SalesStrategyOutputSchema.safeParse(valid).success).toBe(true)
  })

  it("rejects an invalid evidence_type", () => {
    const result = SalesStrategyOutputSchema.safeParse({ ...valid, evidence_type: "GUESSED" })
    expect(result.success).toBe(false)
  })

  it("rejects confidence outside 0-1", () => {
    const result = SalesStrategyOutputSchema.safeParse({ ...valid, confidence: 1.5 })
    expect(result.success).toBe(false)
  })

  it("rejects a non-array things_to_avoid", () => {
    const result = SalesStrategyOutputSchema.safeParse({ ...valid, things_to_avoid: "avoid this" })
    expect(result.success).toBe(false)
  })

  it("accepts empty objection_considerations/things_to_avoid arrays", () => {
    const result = SalesStrategyOutputSchema.safeParse({ ...valid, objection_considerations: [], things_to_avoid: [] })
    expect(result.success).toBe(true)
  })

  it("rejects a missing required field", () => {
    const withoutProblem: Record<string, unknown> = { ...valid }
    delete withoutProblem.primary_problem
    expect(SalesStrategyOutputSchema.safeParse(withoutProblem).success).toBe(false)
  })

  it("has no recommended_channel/recommended_service/priority fields for the AI to invent - those are server-determined", () => {
    expect("recommended_channel" in SalesStrategyOutputSchema.shape).toBe(false)
    expect("recommended_service" in SalesStrategyOutputSchema.shape).toBe(false)
    expect("priority" in SalesStrategyOutputSchema.shape).toBe(false)
    expect("opportunity_id" in SalesStrategyOutputSchema.shape).toBe(false)
  })
})
