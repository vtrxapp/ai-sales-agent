import { describe, expect, it, vi, beforeEach } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

const { afterCallbacks, getAIProviderMock } = vi.hoisted(() => ({
  afterCallbacks: [] as (() => Promise<void> | void)[],
  getAIProviderMock: vi.fn(),
}))

vi.mock("next/server", () => ({
  after: (fn: () => Promise<void> | void) => {
    afterCallbacks.push(fn)
  },
}))

vi.mock("@/lib/ai", () => ({
  getAIProvider: () => getAIProviderMock(),
}))

const {
  processInboundMessage,
  handleOptOut,
  syncCrmOnResponse,
  classifyAndActOnMessage,
  handleInboundWebhookDelivery,
} = await import("./response-processing-service")
import type { InboundMessageProvider, NormalizedInboundMessage } from "@/lib/inbound/types"
import type { AIProvider } from "@/lib/ai/types"
import type { Database, Tables } from "@/lib/types/database.types"

async function flushAfterCallbacks() {
  const callbacks = afterCallbacks.splice(0, afterCallbacks.length)
  await Promise.all(callbacks.map((cb) => cb()))
}

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
    whatsapp_number: "0771234567",
    whatsapp_status: "AVAILABLE",
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

function normalizedMessage(overrides: Partial<NormalizedInboundMessage> = {}): NormalizedInboundMessage {
  return {
    channel: "WHATSAPP",
    provider: "whatsapp_cloud_api",
    externalMessageId: "wamid.ABC",
    externalConversationId: null,
    senderIdentifier: "263771234567",
    recipientIdentifier: "1234567890",
    messageBody: "Hi, yes. What exactly do you offer?",
    receivedAt: new Date().toISOString(),
    rawType: "text",
    metadata: {},
    ...overrides,
  }
}

function fakeAI(output: Record<string, unknown>): AIProvider {
  return {
    model: "fake-model",
    generateStructuredOutput: vi.fn(async () => output as never),
    researchWithWebTools: vi.fn(async () => ({ summary: "", sourceUrls: [] })),
  }
}

type Store = Record<string, Record<string, unknown>[]>

function fakeSupabase(seed: Partial<Store>) {
  const store: Store = {
    businesses: [],
    contacts: [],
    conversations: [],
    inbound_messages: [],
    outreach_send_attempts: [],
    sales_strategies: [],
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
      let limitN: number | null = null

      function matchRows(): Record<string, unknown>[] {
        let rows = (store[table] ?? []).filter(
          (r) => filters.every(([c, v]) => r[c] === v) && excludeFilters.every(([c, v]) => r[c] !== v)
        )
        if (limitN !== null) rows = rows.slice(0, limitN)
        return rows
      }

      function applyMutation(): Record<string, unknown>[] {
        if (mode === "insert" && payload) {
          const row: Record<string, unknown> = {
            id: `generated-${nextId++}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            // Mirrors the real schema's `unread_count integer not null
            // default 0` - this fake doesn't otherwise simulate column
            // defaults.
            ...(table === "conversations" ? { unread_count: 0 } : {}),
            ...payload,
          }
          // Enforce unique(provider, external_message_id) like the real schema.
          if (table === "inbound_messages") {
            const conflict = store[table].some((r) => r.provider === row.provider && r.external_message_id === row.external_message_id)
            if (conflict) throw { code: "23505", message: "duplicate key value violates unique constraint" }
          }
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
        neq(col: string, val: unknown) {
          excludeFilters.push([col, val])
          return builder
        },
        not() {
          return builder
        },
        is(col: string, val: unknown) {
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
        async single() {
          try {
            const rows = applyMutation()
            return rows[0] ? { data: rows[0], error: null } : { data: null, error: { message: "not found" } }
          } catch (err) {
            return { data: null, error: err as { code: string; message: string } }
          }
        },
        async maybeSingle() {
          try {
            const rows = applyMutation()
            return { data: rows[0] ?? null, error: null }
          } catch (err) {
            return { data: null, error: err as { code: string; message: string } }
          }
        },
        then(resolveFn: (v: { data: Record<string, unknown>[] | null; error: { code: string; message: string } | null }) => void) {
          try {
            resolveFn({ data: applyMutation(), error: null })
          } catch (err) {
            resolveFn({ data: null, error: err as { code: string; message: string } })
          }
        },
      }

      return builder
    },
  }

  return { client: client as unknown as SupabaseClient<Database>, store }
}

describe("processInboundMessage", () => {
  it("matches, stores, creates a conversation, and marks it WAITING_FOR_US", async () => {
    const { client, store } = fakeSupabase({ businesses: [business()] })

    const result = await processInboundMessage(client, normalizedMessage())

    expect(result.outcome).toBe("STORED")
    expect(store.inbound_messages).toHaveLength(1)
    expect(store.conversations).toHaveLength(1)
    expect(store.conversations[0].status).toBe("WAITING_FOR_US")
    expect(store.conversations[0].unread_count).toBe(1)
    expect(store.activities.some((a) => a.activity_type === "RESPONSE_RECEIVED")).toBe(true)
  })

  it("stores an unmatched message without a business/conversation and logs RESPONSE_UNMATCHED", async () => {
    const { client, store } = fakeSupabase({ businesses: [] })

    const result = await processInboundMessage(client, normalizedMessage())

    expect(result.outcome).toBe("UNMATCHED")
    expect(store.inbound_messages[0].business_id).toBeNull()
    expect(store.inbound_messages[0].conversation_id).toBeNull()
    expect(store.inbound_messages[0].processing_status).toBe("UNMATCHED")
    expect(store.activities.some((a) => a.activity_type === "RESPONSE_UNMATCHED")).toBe(true)
  })

  it("returns DUPLICATE and stores nothing new for a webhook retry of the same external message id", async () => {
    const { client, store } = fakeSupabase({ businesses: [business()] })

    const first = await processInboundMessage(client, normalizedMessage())
    const second = await processInboundMessage(client, normalizedMessage())

    expect(first.outcome).toBe("STORED")
    expect(second.outcome).toBe("DUPLICATE")
    expect(store.inbound_messages).toHaveLength(1)
  })

  it("never reopens a conversation that's already marked DO_NOT_CONTACT", async () => {
    const { client, store } = fakeSupabase({
      businesses: [business()],
      conversations: [
        { id: "conv-1", business_id: "biz-1", contact_id: null, channel: "WHATSAPP", provider: "whatsapp_cloud_api", status: "DO_NOT_CONTACT", unread_count: 0, last_message_at: null, last_inbound_at: null, last_outbound_at: null },
      ],
    })

    await processInboundMessage(client, normalizedMessage())

    expect(store.conversations[0].status).toBe("DO_NOT_CONTACT")
  })

  it("increments unread_count on each new matched message", async () => {
    const { client, store } = fakeSupabase({ businesses: [business()] })

    await processInboundMessage(client, normalizedMessage({ externalMessageId: "wamid.1" }))
    await processInboundMessage(client, normalizedMessage({ externalMessageId: "wamid.2" }))

    expect(store.conversations[0].unread_count).toBe(2)
  })
})

describe("handleOptOut", () => {
  it("marks the business Do Not Contact with a reason", async () => {
    const { client, store } = fakeSupabase({ businesses: [business()] })

    await handleOptOut(client, business(), null)

    expect(store.businesses[0].do_not_contact).toBe(true)
    expect(store.businesses[0].do_not_contact_reason).toMatch(/inbound reply/i)
  })

  it("is idempotent - opting out an already-suppressed business doesn't error", async () => {
    const { client, store } = fakeSupabase({ businesses: [business({ do_not_contact: true, do_not_contact_reason: "Already suppressed" })] })

    await handleOptOut(client, business({ do_not_contact: true, do_not_contact_reason: "Already suppressed" }), null)

    expect(store.businesses[0].do_not_contact_reason).toBe("Already suppressed")
  })

  it("marks the conversation DO_NOT_CONTACT when a conversation id is given", async () => {
    const { client, store } = fakeSupabase({
      businesses: [business()],
      conversations: [{ id: "conv-1", business_id: "biz-1", status: "WAITING_FOR_US" }],
    })

    await handleOptOut(client, business(), "conv-1")

    expect(store.conversations[0].status).toBe("DO_NOT_CONTACT")
  })
})

describe("syncCrmOnResponse", () => {
  it("moves CONTACTED to REPLIED", async () => {
    const { client, store } = fakeSupabase({ businesses: [business({ pipeline_status: "CONTACTED" })] })

    await syncCrmOnResponse(client, business({ pipeline_status: "CONTACTED" }))

    expect(store.businesses[0].pipeline_status).toBe("REPLIED")
  })

  it("never advances a business already past CONTACTED, even on another response", async () => {
    const { client, store } = fakeSupabase({ businesses: [business({ pipeline_status: "MEETING" })] })

    await syncCrmOnResponse(client, business({ pipeline_status: "MEETING" }))

    expect(store.businesses[0].pipeline_status).toBe("MEETING")
  })

  it("does nothing for a NEW or QUALIFIED business (not yet contacted)", async () => {
    const { client, store } = fakeSupabase({ businesses: [business({ pipeline_status: "NEW" })] })

    await syncCrmOnResponse(client, business({ pipeline_status: "NEW" }))

    expect(store.businesses[0].pipeline_status).toBe("NEW")
  })
})

describe("classifyAndActOnMessage", () => {
  const inboundMessage = (overrides: Partial<Tables<"inbound_messages">> = {}): Tables<"inbound_messages"> => ({
    id: "msg-1",
    conversation_id: "conv-1",
    business_id: "biz-1",
    contact_id: null,
    channel: "WHATSAPP",
    provider: "whatsapp_cloud_api",
    external_message_id: "wamid.ABC",
    external_conversation_id: null,
    direction: "INBOUND",
    message_body: "Stop contacting us",
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
  })

  it("suppresses the business automatically when classified as OPT_OUT", async () => {
    const { client, store } = fakeSupabase({ businesses: [business()], inbound_messages: [inboundMessage()] })
    const ai = fakeAI({ intent: "OPT_OUT", sentiment: "NEGATIVE", urgency: "LOW", sales_stage: "UNKNOWN", confidence: 0.9, reasoning: "Asked to stop." })

    await classifyAndActOnMessage(client, ai, inboundMessage(), business(), "conv-1")

    expect(store.businesses[0].do_not_contact).toBe(true)
    expect(store.activities.some((a) => a.activity_type === "OPT_OUT_DETECTED")).toBe(true)
  })

  it("syncs CRM to REPLIED for a non-opt-out classification", async () => {
    const { client, store } = fakeSupabase({ businesses: [business({ pipeline_status: "CONTACTED" })], inbound_messages: [inboundMessage()] })
    const ai = fakeAI({ intent: "QUESTION", sentiment: "NEUTRAL", urgency: "MEDIUM", sales_stage: "INITIAL_RESPONSE", confidence: 0.8, reasoning: "Asked a question." })

    await classifyAndActOnMessage(client, ai, inboundMessage(), business({ pipeline_status: "CONTACTED" }), "conv-1")

    expect(store.businesses[0].pipeline_status).toBe("REPLIED")
    expect(store.businesses[0].do_not_contact).toBe(false)
  })

  it("never classifies a message already marked SKIPPED", async () => {
    const { client } = fakeSupabase({ businesses: [business()], inbound_messages: [] })
    const ai = fakeAI({ intent: "QUESTION", sentiment: "NEUTRAL", urgency: "MEDIUM", sales_stage: "INITIAL_RESPONSE", confidence: 0.8, reasoning: "x" })

    await classifyAndActOnMessage(client, ai, inboundMessage({ classification_status: "SKIPPED" }), business(), "conv-1")

    expect(ai.generateStructuredOutput).not.toHaveBeenCalled()
  })
})

describe("handleInboundWebhookDelivery", () => {
  beforeEach(() => {
    afterCallbacks.length = 0
    getAIProviderMock.mockReset()
  })

  function fakeProvider(messages: NormalizedInboundMessage[]): InboundMessageProvider {
    return {
      channel: "WHATSAPP",
      providerName: "whatsapp_cloud_api",
      verifySignature: () => true,
      extractInboundMessages: async () => messages,
    }
  }

  it("stores each extracted message and reports accurate outcome counts", async () => {
    const { client } = fakeSupabase({ businesses: [business()] })
    getAIProviderMock.mockImplementation(() => {
      throw new Error("AI not configured in this test")
    })

    const outcome = await handleInboundWebhookDelivery(
      client,
      fakeProvider([normalizedMessage({ externalMessageId: "wamid.1" }), normalizedMessage({ externalMessageId: "wamid.2" })]),
      "{}"
    )

    expect(outcome.stored).toBe(2)
    expect(outcome.unmatched).toBe(0)
    expect(outcome.duplicate).toBe(0)
  })

  it("schedules classification via after() rather than blocking the response", async () => {
    const { client, store } = fakeSupabase({ businesses: [business({ pipeline_status: "CONTACTED" })] })
    getAIProviderMock.mockReturnValue(
      fakeAI({ intent: "QUESTION", sentiment: "NEUTRAL", urgency: "MEDIUM", sales_stage: "INITIAL_RESPONSE", confidence: 0.8, reasoning: "x" })
    )

    await handleInboundWebhookDelivery(client, fakeProvider([normalizedMessage()]), "{}")

    // Not classified yet - the after() callback hasn't run.
    expect(store.inbound_messages[0].classification_status).toBe("PENDING")
    expect(afterCallbacks.length).toBeGreaterThan(0)

    await flushAfterCallbacks()

    expect(store.inbound_messages[0].classification_status).toBe("CLASSIFIED")
    expect(store.businesses[0].pipeline_status).toBe("REPLIED")
  })

  it("never lets a classification failure (e.g. AI not configured) affect the stored message or crash", async () => {
    const { client, store } = fakeSupabase({ businesses: [business()] })
    getAIProviderMock.mockImplementation(() => {
      throw new Error("AI not configured")
    })

    await handleInboundWebhookDelivery(client, fakeProvider([normalizedMessage()]), "{}")
    await expect(flushAfterCallbacks()).resolves.not.toThrow()

    expect(store.inbound_messages[0].classification_status).toBe("PENDING")
  })
})
