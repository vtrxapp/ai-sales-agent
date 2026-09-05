import { describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import {
  classifyOpportunityPriority,
  computeOpportunityScore,
  findMatchingOpportunity,
  normalizeOpportunityTitle,
  upsertDetectedOpportunity,
  type DetectedOpportunityInput,
} from "./opportunity-service"
import type { Database } from "@/lib/types/database.types"

function fakeSupabase() {
  const opportunities: Record<string, unknown>[] = []
  const activities: Record<string, unknown>[] = []
  let nextId = 1

  function makeOpportunitiesBuilder() {
    const filters: [string, unknown][] = []
    let mode: "select" | "insert" | "update" = "select"
    let payload: Record<string, unknown> | null = null

    const builder = {
      select() {
        return builder
      },
      eq(column: string, value: unknown) {
        filters.push([column, value])
        return builder
      },
      insert(p: Record<string, unknown>) {
        mode = "insert"
        payload = p
        return builder
      },
      update(p: Record<string, unknown>) {
        mode = "update"
        payload = p
        return builder
      },
      async maybeSingle() {
        const match = opportunities.find((row) => filters.every(([c, v]) => row[c] === v))
        return { data: match ?? null, error: null }
      },
      async single() {
        if (mode === "insert" && payload) {
          const row = { id: `opp-${nextId++}`, times_detected: 1, status: "IDENTIFIED", ...payload }
          opportunities.push(row)
          return { data: row, error: null }
        }
        if (mode === "update" && payload) {
          const row = opportunities.find((r) => filters.every(([c, v]) => r[c] === v))
          if (!row) return { data: null, error: { message: "not found" } }
          Object.assign(row, payload)
          return { data: row, error: null }
        }
        return { data: null, error: { message: "unsupported" } }
      },
    }
    return builder
  }

  const client = {
    from(table: string) {
      if (table === "opportunities") return makeOpportunitiesBuilder()
      const builder = {
        select() {
          return builder
        },
        eq() {
          return builder
        },
        insert(p: Record<string, unknown>) {
          activities.push(p)
          return builder
        },
        async single() {
          return { data: { id: `activity-${nextId++}`, ...activities[activities.length - 1] }, error: null }
        },
      }
      return builder
    },
  }

  return { client: client as unknown as SupabaseClient<Database>, opportunities, activities }
}

describe("normalizeOpportunityTitle", () => {
  it("lowercases and trims", () => {
    expect(normalizeOpportunityTitle("  Outdated Website  ")).toBe("outdated website")
  })

  it("collapses internal whitespace", () => {
    expect(normalizeOpportunityTitle("No   Online  Booking")).toBe("no online booking")
  })
})

describe("computeOpportunityScore", () => {
  it("sums all six components (25/20/15/15/10/15 = 100)", () => {
    expect(
      computeOpportunityScore({
        business_impact_score: 25,
        evidence_strength_score: 20,
        customer_need_score: 15,
        commercial_fit_score: 15,
        urgency_score: 10,
        feasibility_score: 15,
      })
    ).toBe(100)
  })

  it("returns 0 when every component is 0", () => {
    expect(
      computeOpportunityScore({
        business_impact_score: 0,
        evidence_strength_score: 0,
        customer_need_score: 0,
        commercial_fit_score: 0,
        urgency_score: 0,
        feasibility_score: 0,
      })
    ).toBe(0)
  })
})

describe("classifyOpportunityPriority", () => {
  it.each([
    [100, "CRITICAL"],
    [85, "CRITICAL"],
    [84, "HIGH"],
    [65, "HIGH"],
    [64, "MEDIUM"],
    [40, "MEDIUM"],
    [39, "LOW"],
    [0, "LOW"],
  ])("classifies %i as %s", (score, expected) => {
    expect(classifyOpportunityPriority(score)).toBe(expected)
  })
})

const baseInput: DetectedOpportunityInput = {
  businessId: "biz-1",
  opportunityType: "WEBSITE_REDESIGN",
  title: "Outdated Website",
  description: "desc",
  problem: "problem",
  evidence: "evidence",
  proposedSolution: "solution",
  recommendedService: "service",
  expectedBenefit: "benefit",
  estimatedComplexity: "MEDIUM",
  confidence: 0.7,
  scoreComponents: {
    business_impact_score: 20,
    evidence_strength_score: 15,
    customer_need_score: 10,
    commercial_fit_score: 10,
    urgency_score: 5,
    feasibility_score: 10,
    reasoning: {
      business_impact: "x",
      evidence_strength: "x",
      customer_need: "x",
      commercial_fit: "x",
      urgency: "x",
      feasibility: "x",
    },
  },
  auditId: null,
}

describe("upsertDetectedOpportunity", () => {
  it("inserts a fresh opportunity on first detection, with a server-computed score and priority", async () => {
    const { client, opportunities } = fakeSupabase()
    const result = await upsertDetectedOpportunity(client, baseInput, "user-1")

    expect(result.wasReDetected).toBe(false)
    expect(result.opportunity.score).toBe(70)
    expect(result.opportunity.priority).toBe("HIGH")
    expect(opportunities).toHaveLength(1)
  })

  it("updates in place and bumps times_detected on a repeat detection - never inserts a duplicate (closes the Phase 2 gap)", async () => {
    const { client, opportunities } = fakeSupabase()
    await upsertDetectedOpportunity(client, baseInput, "user-1")
    const second = await upsertDetectedOpportunity(client, baseInput, "user-1")

    expect(second.wasReDetected).toBe(true)
    expect(second.opportunity.times_detected).toBe(2)
    expect(opportunities).toHaveLength(1)
  })

  it("treats a different opportunity_type as a distinct opportunity even with the same title", async () => {
    const { client, opportunities } = fakeSupabase()
    await upsertDetectedOpportunity(client, baseInput, "user-1")
    await upsertDetectedOpportunity(client, { ...baseInput, opportunityType: "MOBILE_APP" }, "user-1")

    expect(opportunities).toHaveLength(2)
  })

  it("treats a differently-worded title as a distinct opportunity (no fuzzy matching)", async () => {
    const { client, opportunities } = fakeSupabase()
    await upsertDetectedOpportunity(client, baseInput, "user-1")
    await upsertDetectedOpportunity(client, { ...baseInput, title: "Old-Fashioned Website" }, "user-1")

    expect(opportunities).toHaveLength(2)
  })
})

describe("findMatchingOpportunity", () => {
  it("finds an opportunity matching business_id + opportunity_type + normalized title", async () => {
    const { client } = fakeSupabase()
    await upsertDetectedOpportunity(client, baseInput, "user-1")

    const found = await findMatchingOpportunity(client, "biz-1", "WEBSITE_REDESIGN", "  outdated website  ")
    expect(found).not.toBeNull()
  })

  it("returns null when nothing matches", async () => {
    const { client } = fakeSupabase()
    const found = await findMatchingOpportunity(client, "biz-1", "WEBSITE_REDESIGN", "Nonexistent")
    expect(found).toBeNull()
  })
})
