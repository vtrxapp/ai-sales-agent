import { describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import {
  generateOutreachDrafts,
  editOutreachDraft,
  approveOutreachDraft,
  rejectOutreachDraft,
} from "./outreach-draft-service"
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
    job_title: "Owner",
    email: null,
    phone: null,
    social_url: null,
    source: "manual",
    verification_status: "VERIFIED",
    whatsapp_number: "+263771234567",
    whatsapp_status: "AVAILABLE",
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function strategy(overrides: Partial<Tables<"sales_strategies">> = {}): Tables<"sales_strategies"> {
  return {
    id: "strategy-1",
    business_id: "biz-1",
    opportunity_id: "opp-1",
    target_contact_id: "contact-1",
    primary_problem: "No online booking flow is visible on the website.",
    supporting_evidence: "The homepage has no booking form or link to one.",
    evidence_type: "OBSERVED",
    why_it_matters: "Customers must call to book.",
    recommended_service: "Online booking system",
    recommended_solution: "Add an online booking system.",
    expected_business_benefit: "Customers could book anytime.",
    sales_angle: "Make class registration easier.",
    value_proposition: "A simple booking flow could reduce phone calls.",
    recommended_channel: "WHATSAPP",
    contact_reason: "Jane is the owner.",
    opening_strategy: "Open by referencing the missing booking flow.",
    objection_considerations: [],
    things_to_avoid: [],
    confidence: 0.8,
    priority: "HIGH",
    status: "ACTIVE",
    model: "fake-model",
    generated_at: new Date().toISOString(),
    generated_by: null,
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
    sales_strategies: [],
    outreach_drafts: [],
    activities: [],
    ...seed,
  }
  let nextId = 1

  const client = {
    from(table: string) {
      const filters: [string, unknown][] = []
      const excludeFilters: [string, unknown][] = []
      let mode: "select" | "insert" | "update" = "select"
      let payload: Record<string, unknown> | null = null

      function matchRows(): Record<string, unknown>[] {
        return (store[table] ?? []).filter(
          (r) => filters.every(([c, v]) => r[c] === v) && excludeFilters.every(([c, v]) => r[c] !== v)
        )
      }

      const builder = {
        select() {
          return builder
        },
        eq(col: string, val: unknown) {
          filters.push([col, val])
          return builder
        },
        neq(col: string, val: unknown) {
          excludeFilters.push([col, val])
          return builder
        },
        order() {
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
        async single() {
          if (mode === "insert" && payload) {
            const row = { id: `generated-${nextId++}`, ...payload }
            store[table].push(row)
            return { data: row, error: null }
          }
          if (mode === "update" && payload) {
            const row = matchRows()[0]
            if (!row) return { data: null, error: { message: "not found" } }
            Object.assign(row, payload)
            return { data: row, error: null }
          }
          const rows = matchRows()
          return rows[0] ? { data: rows[0], error: null } : { data: null, error: { message: "not found" } }
        },
        then(resolve: (v: { data: Record<string, unknown>[]; error: null }) => void) {
          resolve({ data: matchRows(), error: null })
        },
      }

      return builder
    },
  }

  return { client: client as unknown as SupabaseClient<Database>, store }
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

const whatsappOutput = {
  variants: [
    {
      variant: "RECOMMENDED",
      body: "Hi Jane, I noticed ABC Gym doesn't have online booking. We build online booking systems at Zviko Labs - would you be open to hearing an idea?",
    },
    {
      variant: "DIRECT",
      body: "Hi Jane, quick one - ABC Gym has no online booking. Want a quick idea from Zviko Labs for an online booking system?",
    },
  ],
}

describe("generateOutreachDrafts", () => {
  it("generates no drafts and never calls the AI when the channel is NONE", async () => {
    const { client, store } = fakeSupabase({})
    const ai = fakeAI(whatsappOutput)

    const result = await generateOutreachDrafts(
      client,
      ai,
      { business: business(), contact: null, strategy: strategy({ recommended_channel: "NONE" }), opportunity: opportunity() },
      "user-1"
    )

    expect(result.drafts).toEqual([])
    expect(ai.generateStructuredOutput).not.toHaveBeenCalled()
    expect(store.outreach_drafts).toHaveLength(0)
  })

  it("generates and validates drafts for the strategy's recommended channel", async () => {
    const { client, store } = fakeSupabase({})
    const ai = fakeAI(whatsappOutput)

    const result = await generateOutreachDrafts(
      client,
      ai,
      { business: business(), contact: contact(), strategy: strategy(), opportunity: opportunity() },
      "user-1"
    )

    expect(result.reused).toBe(false)
    expect(result.drafts).toHaveLength(2)
    expect(store.outreach_drafts).toHaveLength(2)
    for (const draft of result.drafts) {
      expect(draft.channel).toBe("WHATSAPP")
      expect(typeof draft.personalization_score).toBe("number")
      expect(["PASSED", "FAILED"]).toContain(draft.validation_status)
    }
  })

  it("marks a draft NEEDS_REVIEW when it fails validation, never READY by default", async () => {
    const { client } = fakeSupabase({})
    const ai = fakeAI({ variants: [{ variant: "RECOMMENDED", body: "Hi, we offer innovative digital solutions." }] })

    const result = await generateOutreachDrafts(
      client,
      ai,
      { business: business(), contact: contact(), strategy: strategy(), opportunity: opportunity() },
      "user-1"
    )

    expect(result.drafts[0].validation_status).toBe("FAILED")
    expect(result.drafts[0].status).toBe("NEEDS_REVIEW")
  })

  it("reuses existing non-cancelled drafts instead of calling the AI again", async () => {
    const { client, store } = fakeSupabase({})
    const ai = fakeAI(whatsappOutput)
    const params = { business: business(), contact: contact(), strategy: strategy(), opportunity: opportunity() }

    await generateOutreachDrafts(client, ai, params, "user-1")
    const second = await generateOutreachDrafts(client, ai, params, "user-1")

    expect(second.reused).toBe(true)
    expect(ai.generateStructuredOutput).toHaveBeenCalledTimes(1)
    expect(store.outreach_drafts).toHaveLength(2)
  })

  it("forceRegenerate creates fresh drafts without deleting the prior ones", async () => {
    const { client, store } = fakeSupabase({})
    const ai = fakeAI(whatsappOutput)
    const params = { business: business(), contact: contact(), strategy: strategy(), opportunity: opportunity() }

    const first = await generateOutreachDrafts(client, ai, params, "user-1")
    const second = await generateOutreachDrafts(client, ai, params, "user-1", true)

    expect(second.reused).toBe(false)
    expect(ai.generateStructuredOutput).toHaveBeenCalledTimes(2)
    expect(store.outreach_drafts).toHaveLength(4)
    for (const draft of first.drafts) {
      expect(store.outreach_drafts.some((r) => r.id === draft.id)).toBe(true)
    }
  })

  it("dedupes duplicate variant tags from a single AI response", async () => {
    const { client } = fakeSupabase({})
    const ai = fakeAI({
      variants: [
        { variant: "RECOMMENDED", body: "Hi Jane, ABC Gym has no online booking system - want an idea?" },
        { variant: "RECOMMENDED", body: "Hi Jane, ABC Gym has no online booking system - a different idea?" },
      ],
    })

    const result = await generateOutreachDrafts(
      client,
      ai,
      { business: business(), contact: contact(), strategy: strategy(), opportunity: opportunity() },
      "user-1"
    )

    expect(result.drafts).toHaveLength(1)
  })
})

describe("editOutreachDraft / approveOutreachDraft / rejectOutreachDraft", () => {
  function seedWithDraft(draftOverrides: Partial<Tables<"outreach_drafts">> = {}) {
    const draft: Tables<"outreach_drafts"> = {
      id: "draft-1",
      business_id: "biz-1",
      contact_id: "contact-1",
      opportunity_id: "opp-1",
      sales_strategy_id: "strategy-1",
      channel: "WHATSAPP",
      message_type: "INITIAL_OUTREACH",
      variant: "RECOMMENDED",
      subject: null,
      body: "Hi Jane, ABC Gym has no online booking system - want an idea from Zviko Labs?",
      personalization_score: 80,
      personalization_reasoning: {},
      validation_status: "PASSED",
      validation_errors: [],
      status: "DRAFT",
      is_user_edited: false,
      model: "fake-model",
      generated_at: new Date().toISOString(),
      approved_at: null,
      approved_by: null,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...draftOverrides,
    }
    return fakeSupabase({
      businesses: [business()],
      opportunities: [opportunity()],
      contacts: [contact()],
      sales_strategies: [strategy()],
      outreach_drafts: [draft as unknown as Record<string, unknown>],
    })
  }

  it("edit re-validates against the new body and clears any prior approval", async () => {
    const { client } = seedWithDraft({ status: "READY_TO_SEND", approved_at: new Date().toISOString(), approved_by: "user-1" })

    const updated = await editOutreachDraft(client, "draft-1", { body: "Hi, we offer innovative digital solutions." }, "user-1")

    expect(updated.is_user_edited).toBe(true)
    expect(updated.validation_status).toBe("FAILED")
    expect(updated.status).toBe("NEEDS_REVIEW")
    expect(updated.approved_at).toBeNull()
    expect(updated.approved_by).toBeNull()
  })

  it("edit with a good body re-validates to PASSED/DRAFT", async () => {
    const { client } = seedWithDraft()

    const updated = await editOutreachDraft(
      client,
      "draft-1",
      { body: "Hi Jane, I noticed ABC Gym doesn't have an online booking system yet - want an idea from Zviko Labs?" },
      "user-1"
    )

    expect(updated.validation_status).toBe("PASSED")
    expect(updated.status).toBe("DRAFT")
  })

  it("approve throws and does not change status when validation has failed", async () => {
    const { client, store } = seedWithDraft({ validation_status: "FAILED", status: "NEEDS_REVIEW" })

    await expect(approveOutreachDraft(client, "draft-1", "user-1")).rejects.toThrow(/fails validation/i)
    expect(store.outreach_drafts[0].status).toBe("NEEDS_REVIEW")
  })

  it("approve sets status to READY_TO_SEND and stamps approved_at/approved_by when validation passed", async () => {
    const { client } = seedWithDraft({ validation_status: "PASSED" })

    const updated = await approveOutreachDraft(client, "draft-1", "user-1")

    expect(updated.status).toBe("READY_TO_SEND")
    expect(updated.approved_by).toBe("user-1")
    expect(updated.approved_at).not.toBeNull()
  })

  it("reject sets status to CANCELLED", async () => {
    const { client } = seedWithDraft()

    const updated = await rejectOutreachDraft(client, "draft-1", "user-1")

    expect(updated.status).toBe("CANCELLED")
  })
})
