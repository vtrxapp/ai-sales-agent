import { describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { classifyInboundMessage } from "./response-classification-service"
import type { AIProvider } from "@/lib/ai/types"
import type { Database, Tables } from "@/lib/types/database.types"

function business(overrides: Partial<Tables<"businesses">> = {}): Tables<"businesses"> {
  return {
    id: "biz-1",
    name: "ABC Gym",
    name_normalized: "abc gym",
    industry: "Fitness",
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
    do_not_contact: false,
    do_not_contact_reason: null,
    do_not_contact_at: null,
    social_links: {},
    pipeline_status: "CONTACTED",
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

function inboundMessage(overrides: Partial<Tables<"inbound_messages">> = {}): Tables<"inbound_messages"> {
  return {
    id: "msg-1",
    conversation_id: "conv-1",
    business_id: "biz-1",
    contact_id: null,
    channel: "WHATSAPP",
    provider: "whatsapp_cloud_api",
    external_message_id: "wamid.ABC",
    external_conversation_id: null,
    direction: "INBOUND",
    message_body: "Hi, yes. What exactly do you offer?",
    sender_identifier: "263771234567",
    recipient_identifier: "1234567890",
    received_at: new Date().toISOString(),
    raw_type: "text",
    metadata: {},
    processing_status: "MATCHED",
    classification_status: "PENDING",
    intent: null,
    sentiment: null,
    urgency: null,
    sales_stage: null,
    classification_confidence: null,
    classification_reasoning: {},
    classification_model: null,
    classified_at: null,
    recommended_action: null,
    recommended_action_reason: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
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

type Store = Record<string, Record<string, unknown>[]>

function fakeSupabase(seed: Partial<Store>) {
  const store: Store = { businesses: [], inbound_messages: [], outreach_send_attempts: [], sales_strategies: [], activities: [], ...seed }
  let nextId = 1

  const client = {
    from(table: string) {
      const filters: [string, unknown][] = []
      const excludeFilters: [string, unknown][] = []
      let mode: "select" | "insert" | "update" = "select"
      let payload: Record<string, unknown> | null = null
      let limitN: number | null = null

      function matchRows(): Record<string, unknown>[] {
        let rows = (store[table] ?? []).filter(
          (r) => filters.every(([c, v]) => r[c] === v) && excludeFilters.every(([c, v]) => r[c] !== v)
        )
        if (limitN !== null) rows = rows.slice(0, limitN)
        return rows
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
        async single() {
          return resolve(false)
        },
        async maybeSingle() {
          return resolve(true)
        },
        // A bare `await` (no .single()/.maybeSingle()) goes through this
        // thenable - update/insert must apply their mutation here too,
        // or a fire-and-forget update like the FAILED-status write in
        // the catch block would silently never touch the store.
        then(resolveFn: (v: { data: Record<string, unknown>[]; error: null }) => void) {
          if (mode === "update" && payload) {
            const rows = matchRows()
            for (const row of rows) Object.assign(row, payload)
            resolveFn({ data: rows, error: null })
            return
          }
          if (mode === "insert" && payload) {
            const row = { id: `generated-${nextId++}`, created_at: new Date().toISOString(), ...payload }
            store[table].push(row)
            resolveFn({ data: [row], error: null })
            return
          }
          resolveFn({ data: matchRows(), error: null })
        },
      }

      function resolve(allowEmpty: boolean): { data: Record<string, unknown> | null; error: { message: string } | null } {
        if (mode === "update" && payload) {
          const rows = matchRows()
          for (const row of rows) Object.assign(row, payload)
          return rows[0] ? { data: rows[0], error: null } : allowEmpty ? { data: null, error: null } : { data: null, error: { message: "not found" } }
        }
        if (mode === "insert" && payload) {
          const row = { id: `generated-${nextId++}`, created_at: new Date().toISOString(), ...payload }
          store[table].push(row)
          return { data: row, error: null }
        }
        const rows = matchRows()
        return rows[0] ? { data: rows[0], error: null } : allowEmpty ? { data: null, error: null } : { data: null, error: { message: "not found" } }
      }

      return builder
    },
  }

  return { client: client as unknown as SupabaseClient<Database>, store }
}

const validClassification = {
  intent: "QUESTION",
  sentiment: "NEUTRAL",
  urgency: "MEDIUM",
  sales_stage: "INITIAL_RESPONSE",
  confidence: 0.8,
  reasoning: "They asked a direct question about the offer.",
}

describe("classifyInboundMessage", () => {
  it("classifies a message and stores the result plus a deterministic recommended action", async () => {
    const { client } = fakeSupabase({ businesses: [business()], inbound_messages: [inboundMessage()] })
    const ai = fakeAI(validClassification)

    const updated = await classifyInboundMessage(client, ai, inboundMessage())

    expect(updated.intent).toBe("QUESTION")
    expect(updated.sentiment).toBe("NEUTRAL")
    expect(updated.classification_status).toBe("CLASSIFIED")
    expect(updated.classification_model).toBe("fake-model")
    expect(updated.recommended_action).toMatch(/reply/i)
    expect(updated.classified_at).not.toBeNull()
  })

  it("logs a RESPONSE_CLASSIFIED activity", async () => {
    const { client, store } = fakeSupabase({ businesses: [business()], inbound_messages: [inboundMessage()] })
    const ai = fakeAI(validClassification)

    await classifyInboundMessage(client, ai, inboundMessage())

    expect(store.activities.some((a) => a.activity_type === "RESPONSE_CLASSIFIED")).toBe(true)
  })

  it("marks classification_status FAILED and rethrows when the AI call fails", async () => {
    const { client, store } = fakeSupabase({ businesses: [business()], inbound_messages: [inboundMessage()] })
    const ai = fakeAI(() => {
      throw new Error("AI unavailable")
    })

    await expect(classifyInboundMessage(client, ai, inboundMessage())).rejects.toThrow("AI unavailable")
    expect(store.inbound_messages[0].classification_status).toBe("FAILED")
  })

  it("refuses to classify a message with no business context", async () => {
    const { client } = fakeSupabase({})
    const ai = fakeAI(validClassification)

    await expect(classifyInboundMessage(client, ai, inboundMessage({ business_id: null }))).rejects.toThrow(/no business context/i)
  })

  it("maps an OPT_OUT classification to the do-not-contact recommended action", async () => {
    const { client } = fakeSupabase({ businesses: [business()], inbound_messages: [inboundMessage()] })
    const ai = fakeAI({ ...validClassification, intent: "OPT_OUT" })

    const updated = await classifyInboundMessage(client, ai, inboundMessage())
    expect(updated.recommended_action).toMatch(/do not contact/i)
  })
})
