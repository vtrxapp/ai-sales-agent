import { describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { auditWebsite, computeOverallScore, isValidHttpUrl, type AuditCategoryScores } from "./website-audit-service"
import type { AIProvider } from "@/lib/ai/types"
import type { Database, Tables } from "@/lib/types/database.types"

function business(overrides: Partial<Tables<"businesses">> = {}): Tables<"businesses"> {
  return {
    id: "biz-1",
    name: "Test Business",
    name_normalized: "test business",
    industry: null,
    description: null,
    location: null,
    city: null,
    country: null,
    website: null,
    website_normalized: null,
    phone: null,
    phone_normalized: null,
    whatsapp_number: null,
    whatsapp_status: "UNKNOWN",
    email: null,
    social_links: {},
    pipeline_status: "NEW",
    source: "manual",
    source_url: null,
    discovered_at: new Date().toISOString(),
    do_not_contact: false,
    do_not_contact_reason: null,
    do_not_contact_at: null,
    last_researched_at: null,
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function fakeSupabase(businessRow: Tables<"businesses">) {
  const inserted: { table: string; payload: Record<string, unknown> }[] = []
  let nextId = 1

  const client = {
    from(table: string) {
      let insertPayload: Record<string, unknown> | null = null
      const builder = {
        select() {
          return builder
        },
        eq() {
          return builder
        },
        insert(payload: Record<string, unknown>) {
          insertPayload = payload
          inserted.push({ table, payload })
          return builder
        },
        async single() {
          if (table === "businesses") return { data: businessRow, error: null }
          return { data: { id: `generated-${nextId++}`, ...insertPayload }, error: null }
        },
      }
      return builder
    },
  }
  return { client: client as unknown as SupabaseClient<Database>, inserted }
}

function fakeAI(): AIProvider {
  return {
    model: "fake-model",
    generateStructuredOutput: vi.fn(async () => ({}) as never),
    researchWithWebTools: vi.fn(async () => ({ summary: "", sourceUrls: [] })),
  }
}

describe("computeOverallScore", () => {
  const allEqual = (value: number): AuditCategoryScores => ({
    technical_score: value,
    mobile_score: value,
    ux_score: value,
    accessibility_score: value,
    seo_score: value,
    content_score: value,
    conversion_score: value,
    functionality_score: value,
  })

  it("returns the same value when every category scores equally", () => {
    expect(computeOverallScore(allEqual(80))).toBe(80)
  })

  it("weights technical/mobile/ux/conversion at 15% each", () => {
    const scores = { ...allEqual(0), technical_score: 100 }
    expect(computeOverallScore(scores)).toBe(15)
  })

  it("weights accessibility/seo/content/functionality at 10% each", () => {
    const scores = { ...allEqual(0), seo_score: 100 }
    expect(computeOverallScore(scores)).toBe(10)
  })

  it("rounds to the nearest integer", () => {
    const scores = { ...allEqual(0), technical_score: 33 }
    expect(computeOverallScore(scores)).toBe(Math.round(33 * 0.15))
  })
})

describe("isValidHttpUrl", () => {
  it("accepts an https URL", () => {
    expect(isValidHttpUrl("https://example.com")).toBe(true)
  })

  it("accepts an http URL", () => {
    expect(isValidHttpUrl("http://example.com")).toBe(true)
  })

  it("rejects a non-URL string", () => {
    expect(isValidHttpUrl("not a url")).toBe(false)
  })

  it("rejects a non-http(s) scheme", () => {
    expect(isValidHttpUrl("ftp://example.com")).toBe(false)
  })
})

describe("auditWebsite", () => {
  it("records NO_WEBSITE and never calls the AI when the business has no website", async () => {
    const { client, inserted } = fakeSupabase(business({ website: null }))
    const ai = fakeAI()

    const audit = await auditWebsite(client, ai, "biz-1", "user-1")

    expect(audit.audit_status).toBe("NO_WEBSITE")
    expect(ai.researchWithWebTools).not.toHaveBeenCalled()
    expect(ai.generateStructuredOutput).not.toHaveBeenCalled()
    expect(inserted.find((i) => i.table === "website_audits")?.payload.website_url).toBeNull()
  })

  it("records INVALID_URL and never calls the AI when the website value isn't a usable URL", async () => {
    const { client, inserted } = fakeSupabase(business({ website: "not-a-url" }))
    const ai = fakeAI()

    const audit = await auditWebsite(client, ai, "biz-1", "user-1")

    expect(audit.audit_status).toBe("INVALID_URL")
    expect(ai.researchWithWebTools).not.toHaveBeenCalled()
    expect(ai.generateStructuredOutput).not.toHaveBeenCalled()
    expect(inserted.find((i) => i.table === "website_audits")?.payload.website_url).toBe("not-a-url")
  })
})
