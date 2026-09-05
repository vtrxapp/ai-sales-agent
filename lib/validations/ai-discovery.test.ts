import { describe, expect, it } from "vitest"

import { DiscoveryOutputSchema } from "./ai-discovery"

describe("DiscoveryOutputSchema", () => {
  it("accepts a list of candidates", () => {
    const result = DiscoveryOutputSchema.safeParse({
      candidates: [
        { name: "ABC Gym", industry: "Gyms", location: "Harare", confidence: 0.8 },
        { name: "XYZ Fitness", confidence: 0.5 },
      ],
    })
    expect(result.success).toBe(true)
  })

  it("accepts an empty candidate list (no results is valid)", () => {
    expect(DiscoveryOutputSchema.safeParse({ candidates: [] }).success).toBe(true)
  })

  it("requires a name for every candidate", () => {
    const result = DiscoveryOutputSchema.safeParse({ candidates: [{ confidence: 0.5 }] })
    expect(result.success).toBe(false)
  })

  it("requires confidence on every candidate", () => {
    const result = DiscoveryOutputSchema.safeParse({ candidates: [{ name: "ABC Gym" }] })
    expect(result.success).toBe(false)
  })

  it("rejects confidence outside 0-1", () => {
    const result = DiscoveryOutputSchema.safeParse({
      candidates: [{ name: "ABC Gym", confidence: 1.2 }],
    })
    expect(result.success).toBe(false)
  })
})
