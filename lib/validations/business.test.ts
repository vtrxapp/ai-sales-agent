import { describe, expect, it } from "vitest"

import {
  contactFormSchema,
  discoveryCriteriaSchema,
  manualBusinessSchema,
  opportunityFormSchema,
} from "./business"

describe("discoveryCriteriaSchema", () => {
  it("accepts criteria with at least an industry", () => {
    const result = discoveryCriteriaSchema.safeParse({ industry: "Gyms", count: "10" })
    expect(result.success).toBe(true)
  })

  it("rejects criteria with none of industry/location/business_type/search_query", () => {
    const result = discoveryCriteriaSchema.safeParse({ count: "10" })
    expect(result.success).toBe(false)
  })

  it("rejects a count above 20", () => {
    const result = discoveryCriteriaSchema.safeParse({ industry: "Gyms", count: "25" })
    expect(result.success).toBe(false)
  })

  it("rejects a count below 1", () => {
    const result = discoveryCriteriaSchema.safeParse({ industry: "Gyms", count: "0" })
    expect(result.success).toBe(false)
  })

  it("coerces a numeric string count", () => {
    const result = discoveryCriteriaSchema.safeParse({ industry: "Gyms", count: "5" })
    expect(result.success && result.data.count).toBe(5)
  })
})

describe("manualBusinessSchema", () => {
  it("accepts a minimal valid business", () => {
    expect(manualBusinessSchema.safeParse({ name: "ABC Gym" }).success).toBe(true)
  })

  it("rejects a name shorter than 2 characters", () => {
    expect(manualBusinessSchema.safeParse({ name: "A" }).success).toBe(false)
  })

  it("rejects an invalid website URL", () => {
    const result = manualBusinessSchema.safeParse({ name: "ABC Gym", website: "not a url" })
    expect(result.success).toBe(false)
  })

  it("accepts an empty website string (optional field)", () => {
    const result = manualBusinessSchema.safeParse({ name: "ABC Gym", website: "" })
    expect(result.success).toBe(true)
  })

  it("rejects an invalid email", () => {
    const result = manualBusinessSchema.safeParse({ name: "ABC Gym", email: "not-an-email" })
    expect(result.success).toBe(false)
  })
})

describe("contactFormSchema", () => {
  const businessId = "123e4567-e89b-12d3-a456-426614174000"

  it("accepts a minimal valid contact", () => {
    expect(contactFormSchema.safeParse({ business_id: businessId, name: "Jane Doe" }).success).toBe(true)
  })

  it("rejects a non-uuid business_id", () => {
    const result = contactFormSchema.safeParse({ business_id: "not-a-uuid", name: "Jane Doe" })
    expect(result.success).toBe(false)
  })
})

describe("opportunityFormSchema", () => {
  const businessId = "123e4567-e89b-12d3-a456-426614174000"

  it("accepts a minimal valid opportunity", () => {
    const result = opportunityFormSchema.safeParse({
      business_id: businessId,
      opportunity_type: "BOOKING_SYSTEM",
      title: "Online booking",
    })
    expect(result.success).toBe(true)
  })

  it("rejects an unknown opportunity_type", () => {
    const result = opportunityFormSchema.safeParse({
      business_id: businessId,
      opportunity_type: "NOT_REAL",
      title: "Online booking",
    })
    expect(result.success).toBe(false)
  })
})
