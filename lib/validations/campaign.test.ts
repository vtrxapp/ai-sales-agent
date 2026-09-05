import { describe, expect, it } from "vitest"

import { campaignFormSchema } from "./campaign"

const validInput = {
  product_id: "123e4567-e89b-12d3-a456-426614174000",
  name: "Harare Gyms Q1 Outreach",
  campaign_type: "CLIENT_ACQUISITION" as const,
}

describe("campaignFormSchema", () => {
  it("accepts a minimal valid campaign", () => {
    const result = campaignFormSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it("rejects a non-uuid product_id", () => {
    const result = campaignFormSchema.safeParse({ ...validInput, product_id: "not-a-uuid" })
    expect(result.success).toBe(false)
  })

  it("rejects a name shorter than 2 characters", () => {
    const result = campaignFormSchema.safeParse({ ...validInput, name: "A" })
    expect(result.success).toBe(false)
  })

  it("rejects an unknown campaign_type", () => {
    const result = campaignFormSchema.safeParse({ ...validInput, campaign_type: "NOT_REAL" })
    expect(result.success).toBe(false)
  })

  it("rejects an end_date before the start_date", () => {
    const result = campaignFormSchema.safeParse({
      ...validInput,
      start_date: "2026-02-01",
      end_date: "2026-01-01",
    })
    expect(result.success).toBe(false)
  })

  it("accepts an end_date on or after the start_date", () => {
    const result = campaignFormSchema.safeParse({
      ...validInput,
      start_date: "2026-01-01",
      end_date: "2026-01-01",
    })
    expect(result.success).toBe(true)
  })

  it("rejects a negative budget", () => {
    const result = campaignFormSchema.safeParse({ ...validInput, budget: "-100" })
    expect(result.success).toBe(false)
  })

  it("rejects a non-numeric budget", () => {
    const result = campaignFormSchema.safeParse({ ...validInput, budget: "not-a-number" })
    expect(result.success).toBe(false)
  })

  it("accepts a valid positive budget", () => {
    const result = campaignFormSchema.safeParse({ ...validInput, budget: "500" })
    expect(result.success).toBe(true)
  })
})
