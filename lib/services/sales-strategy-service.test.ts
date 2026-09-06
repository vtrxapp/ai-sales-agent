import { describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { generateSalesStrategy } from "./sales-strategy-service"
import type { AIProvider } from "@/lib/ai/types"
import type { Database, Tables } from "@/lib/types/database.types"

function business(overrides: Partial<Tables<"businesses">> = {}): Tables<"businesses"> {
  return {
    id: "biz-1",
    name: "ABC Gym",
    name_normalized: "abc gym",
    industry: "Fitness",
    description: null,
    location: "Harare, Zimbabwe",
    city: "Harare",
    country: "Zimbabwe",
    website: "https://abcgym.co.zw",
    website_normalized: "abcgym.co.zw",
    phone: null,
    phone_normalized: null,
    whatsapp_number: null,
    whatsapp_status: "UNKNOWN",
    email: null,
    social_links: {},
    pipeline_status: "QUALIFIED",
    source: "manual",
    source_url: null,
    discovered_at: new Date().toISOString(),
    last_researched_at: null,
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function opportunity(overrides: Partial<Tables<"opportunities">> = {}): Tables<"opportunities"> {
  return {
    id: "opp-1",
    business_id: "biz-1",
    opportunity_type: "BOOKING_SYSTEM",
    title: "No online booking",
    title_normalized: "no online booking",
    description: null,
    problem: "No booking form on the site.",
    proposed_solution: "Add an online booking system.",
    evidence: "No booking form found on the homepage.",
    recommended_service: "Online booking system",
    expected_benefit: "Customers could book anytime.",
    estimated_complexity: "MEDIUM",
    estimated_value: null,
    priority: "HIGH",
    status: "IDENTIFIED",
    confidence: 0.8,
    source: "ai_opportunity_analysis",
    score: 80,
    business_impact_score: 20,
    evidence_strength_score: 15,
    customer_need_score: 15,
    commercial_fit_score: 15,
    urgency_score: 5,
    feasibility_score: 10,
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

function contact(overrides: Partial<Tables<"contacts">> = {}): Tables<"contacts"> {
  return {
    id: "contact-1",
    business_id: "biz-1",
    name: "Jane Doe",
    job_title: null,
    email: null,
    phone: null,
    social_url: null,
    source: "manual",
    verification_status: "UNKNOWN",
    whatsapp_number: null,
    whatsapp_status: "UNKNOWN",
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

type Store = Record<string, Record<string, unknown>[]>

function fakeSupabase(seed: Partial<Store>) {
  const store: Store = {
    businesses: [],
    opportunities: [],
    contacts: [],
    business_research_notes: [],
    website_audits: [],
    sales_strategies: [],
    activities: [],
    ...seed,
  }
  let nextId = 1

  const client = {
    from(table: string) {
      const filters: [string, unknown][] = []
      let limitN: number | null = null
      let mode: "select" | "insert" | "update" = "select"
      let payload: Record<string, unknown> | null = null

      function matchRows(): Record<string, unknown>[] {
        let rows = (store[table] ?? []).filter((r) => filters.every(([c, v]) => r[c] === v))
        if (limitN !== null) rows = rows.slice(0, limitN)
        return rows
      }

      // Applies the insert/update side effect (exactly once, however the
      // query is awaited - via a bare await, .single(), or .maybeSingle())
      // and returns the resulting rows.
      let executed = false
      function execute(): Record<string, unknown>[] {
        if (executed) return matchRows()
        executed = true
        if (mode === "insert" && payload) {
          // Simulates the real DB's `status default 'ACTIVE'` on sales_strategies -
          // the real insert never sets status explicitly, relying on that default.
          const defaults = table === "sales_strategies" ? { status: "ACTIVE" } : {}
          const row = { id: `generated-${nextId++}`, ...defaults, ...payload }
          store[table].push(row)
          return [row]
        }
        if (mode === "update" && payload) {
          const rows = matchRows()
          for (const row of rows) Object.assign(row, payload)
          return rows
        }
        return matchRows()
      }

      const builder = {
        select() {
          return builder
        },
        eq(col: string, val: unknown) {
          filters.push([col, val])
          return builder
        },
        order() {
          return builder
        },
        limit(n: number) {
          limitN = n
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
          const rows = execute()
          return { data: rows[0] ?? null, error: null }
        },
        async single() {
          const rows = execute()
          return rows[0] ? { data: rows[0], error: null } : { data: null, error: { message: "not found" } }
        },
        then(resolve: (v: { data: Record<string, unknown>[]; error: null }) => void) {
          resolve({ data: execute(), error: null })
        },
      }

      return builder
    },
  }

  return { client: client as unknown as SupabaseClient<Database>, store }
}

const strategyOutput = {
  primary_problem: "No online booking flow is visible on the website.",
  supporting_evidence: "The homepage has no booking form or link to one.",
  evidence_type: "OBSERVED",
  why_it_matters: "Customers must call to book, which may lose bookings outside hours.",
  recommended_solution: "Add an online booking system.",
  expected_business_benefit: "Customers could book anytime.",
  sales_angle: "Make class registration easier.",
  value_proposition: "A simple booking flow could reduce phone calls.",
  contact_reason: "This contact appears to be the best available point of contact.",
  opening_strategy: "Open by referencing the missing booking flow.",
  objection_considerations: [],
  things_to_avoid: [],
  confidence: 0.8,
}

function fakeAI(output: Record<string, unknown> | (() => never)): AIProvider {
  return {
    model: "fake-model",
    generateStructuredOutput: vi.fn(async () => {
      if (typeof output === "function") return output()
      return output as never
    }),
    researchWithWebTools: vi.fn(async () => ({ summary: "", sourceUrls: [] })),
  }
}

describe("generateSalesStrategy", () => {
  it("throws a clear error when the business has no active opportunity", async () => {
    const { client } = fakeSupabase({
      businesses: [business()],
      opportunities: [opportunity({ status: "CLOSED" })],
    })

    await expect(generateSalesStrategy(client, fakeAI(strategyOutput), "biz-1", "user-1")).rejects.toThrow(
      /no active opportunity/i
    )
  })

  it("selects the highest-scored active opportunity and the best available contact/channel", async () => {
    const owner = contact({
      id: "c1",
      name: "Jane Doe",
      job_title: "Owner",
      verification_status: "VERIFIED",
      whatsapp_number: "+263771234567",
      whatsapp_status: "AVAILABLE",
    })
    const lowScored = opportunity({ id: "opp-low", score: 40 })
    const highScored = opportunity({ id: "opp-high", score: 80, priority: "HIGH" })
    const { client } = fakeSupabase({
      businesses: [business()],
      opportunities: [lowScored, highScored],
      contacts: [owner],
    })

    const result = await generateSalesStrategy(client, fakeAI(strategyOutput), "biz-1", "user-1")

    expect(result.primaryOpportunity.id).toBe("opp-high")
    expect(result.contactSelection.contact?.id).toBe("c1")
    expect(result.channelSelection.channel).toBe("WHATSAPP")
    expect(result.strategy.priority).toBe("HIGH")
    expect(result.strategy.recommended_channel).toBe("WHATSAPP")
    expect(result.strategy.target_contact_id).toBe("c1")
    expect(result.wasSuperseded).toBe(false)
  })

  it("falls back to NONE channel and a null contact when nothing usable is on file, without inventing anyone", async () => {
    const { client } = fakeSupabase({
      businesses: [business({ whatsapp_status: "UNKNOWN", whatsapp_number: null, email: null })],
      opportunities: [opportunity()],
    })

    const result = await generateSalesStrategy(client, fakeAI(strategyOutput), "biz-1", "user-1")

    expect(result.contactSelection.contact).toBeNull()
    expect(result.channelSelection.channel).toBe("NONE")
    expect(result.strategy.target_contact_id).toBeNull()
    expect(result.strategy.recommended_channel).toBe("NONE")
  })

  it("supersedes - never deletes - a prior ACTIVE strategy for the same business+opportunity on a repeat call", async () => {
    const { client, store } = fakeSupabase({
      businesses: [business()],
      opportunities: [opportunity()],
    })

    const first = await generateSalesStrategy(client, fakeAI(strategyOutput), "biz-1", "user-1")
    const second = await generateSalesStrategy(client, fakeAI(strategyOutput), "biz-1", "user-1")

    expect(second.wasSuperseded).toBe(true)
    expect(second.strategy.id).not.toBe(first.strategy.id)
    expect(store.sales_strategies).toHaveLength(2)
    const firstRow = store.sales_strategies.find((s) => s.id === first.strategy.id)
    expect(firstRow?.status).toBe("SUPERSEDED")
    const secondRow = store.sales_strategies.find((s) => s.id === second.strategy.id)
    expect(secondRow?.status).toBe("ACTIVE")
  })

  it("propagates an AI error rather than saving a malformed strategy", async () => {
    const { client, store } = fakeSupabase({
      businesses: [business()],
      opportunities: [opportunity()],
    })
    const failingAI = fakeAI(() => {
      throw new Error("AI response did not match the expected schema")
    })

    await expect(generateSalesStrategy(client, failingAI, "biz-1", "user-1")).rejects.toThrow(/did not match/i)
    expect(store.sales_strategies).toHaveLength(0)
  })
})
