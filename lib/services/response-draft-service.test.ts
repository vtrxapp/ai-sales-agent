import { describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { generateResponseDraft, findActiveResponseDrafts, listResponseDraftsForConversation } from "./response-draft-service"
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
    do_not_contact: false,
    do_not_contact_reason: null,
    do_not_contact_at: null,
    social_links: {},
    pipeline_status: "REPLIED",
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

function contact(overrides: Partial<Tables<"contacts">> = {}): Tables<"contacts"> {
  return {
    id: "contact-1",
    business_id: "biz-1",
    name: "Jane Doe",
    job_title: "Owner",
    email: "jane@abcgym.co.zw",
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

function conversation(overrides: Partial<Tables<"conversations">> = {}): Tables<"conversations"> {
  return {
    id: "conv-1",
    business_id: "biz-1",
    contact_id: "contact-1",
    channel: "WHATSAPP",
    provider: "whatsapp_cloud_api",
    external_conversation_id: null,
    status: "WAITING_FOR_US",
    last_message_at: new Date().toISOString(),
    last_inbound_at: new Date().toISOString(),
    last_outbound_at: null,
    unread_count: 1,
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
    contact_id: "contact-1",
    channel: "WHATSAPP",
    provider: "whatsapp_cloud_api",
    external_message_id: "wamid.1",
    external_conversation_id: null,
    direction: "INBOUND",
    message_body: "Yes, we're interested. Can you tell me more about the booking system?",
    sender_identifier: "263771234567",
    recipient_identifier: "263779999999",
    received_at: new Date().toISOString(),
    raw_type: "text",
    metadata: {},
    processing_status: "MATCHED",
    classification_status: "CLASSIFIED",
    intent: "INTERESTED",
    sentiment: "POSITIVE",
    urgency: "MEDIUM",
    sales_stage: "INITIAL_RESPONSE",
    classification_confidence: 0.9,
    classification_reasoning: { text: "They expressed interest and asked a follow-up question." },
    classification_model: "fake-model",
    classified_at: new Date().toISOString(),
    recommended_action: "Explain the booking system",
    recommended_action_reason: "They asked directly about it.",
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

type Store = Record<string, Record<string, unknown>[]>

function fakeSupabase(seed: Partial<Store>) {
  const store: Store = {
    businesses: [],
    contacts: [],
    conversations: [],
    inbound_messages: [],
    sales_strategies: [],
    opportunities: [],
    outreach_drafts: [],
    outreach_send_attempts: [],
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
        limit() {
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
        then(resolveFn: (v: { data: Record<string, unknown>[] | null; error: null }) => void) {
          if (mode === "update" && payload) {
            const rows = matchRows()
            for (const row of rows) Object.assign(row, payload)
            resolveFn({ data: rows, error: null })
            return
          }
          resolveFn({ data: matchRows(), error: null })
        },
      }

      function resolve(allowEmpty: boolean): { data: Record<string, unknown> | null; error: { message: string } | null } {
        if (mode === "insert" && payload) {
          const row = { id: `generated-${nextId++}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...payload }
          store[table].push(row)
          return { data: row, error: null }
        }
        if (mode === "update" && payload) {
          const rows = matchRows()
          for (const row of rows) Object.assign(row, payload)
          return rows[0] ? { data: rows[0], error: null } : allowEmpty ? { data: null, error: null } : { data: null, error: { message: "not found" } }
        }
        const rows = matchRows()
        return rows[0] ? { data: rows[0], error: null } : allowEmpty ? { data: null, error: null } : { data: null, error: { message: "not found" } }
      }

      return builder
    },
  }

  return { client: client as unknown as SupabaseClient<Database>, store }
}

function fakeAI(output: Record<string, unknown> | (() => never)): AIProvider & { generateStructuredOutput: ReturnType<typeof vi.fn> } {
  return {
    model: "fake-model",
    generateStructuredOutput: vi.fn(async () => {
      if (typeof output === "function") return output()
      return output as never
    }),
    researchWithWebTools: vi.fn(async () => ({ summary: "", sourceUrls: [] })),
  }
}

const whatsappResponseOutput = {
  variants: [
    {
      variant: "RECOMMENDED",
      body: "Absolutely - it lets customers see live availability and book a class themselves, no more phone calls needed.",
      rationale: "They asked directly about the booking system, so this explains it and invites a follow-up.",
    },
    {
      variant: "DIRECT",
      body: "Sure - customers could book classes online themselves instead of calling.",
      rationale: "A short, practical version of the same explanation.",
    },
  ],
}

const emailResponseOutput = {
  variants: [
    {
      variant: "RECOMMENDED",
      subject: "booking system",
      body: "Absolutely - it lets customers see live availability and book a class themselves.",
      rationale: "They asked about the booking system.",
    },
  ],
}

function seedHappyPath(overrides: { business?: Partial<Tables<"businesses">>; message?: Partial<Tables<"inbound_messages">> } = {}) {
  return fakeSupabase({
    businesses: [business(overrides.business)],
    contacts: [contact()],
    conversations: [conversation()],
    inbound_messages: [inboundMessage(overrides.message)],
    sales_strategies: [strategy()],
    opportunities: [opportunity()],
  })
}

describe("generateResponseDraft", () => {
  it("generates and stores response drafts linked to the conversation and the message being answered", async () => {
    const { client, store } = seedHappyPath()
    const ai = fakeAI(whatsappResponseOutput)

    const result = await generateResponseDraft(client, ai, "conv-1", "user-1")

    expect(result.outcome).toBe("GENERATED")
    if (result.outcome !== "GENERATED") throw new Error("expected GENERATED")
    expect(result.drafts).toHaveLength(2)
    for (const draft of result.drafts) {
      expect(draft.message_type).toBe("RESPONSE")
      expect(draft.conversation_id).toBe("conv-1")
      expect(draft.response_to_message_id).toBe("msg-1")
      expect(draft.channel).toBe("WHATSAPP")
      expect(draft.opportunity_id).toBe("opp-1")
      expect(draft.sales_strategy_id).toBe("strategy-1")
      expect(typeof draft.rationale).toBe("string")
      // No personalization score for a response - the cold-outreach
      // rubric (business name/evidence-anchor references) doesn't apply.
      expect(draft.personalization_score).toBeNull()
    }
    expect(store.outreach_drafts).toHaveLength(2)
    expect(store.activities.some((a) => a.activity_type === "RESPONSE_DRAFT_GENERATED")).toBe(true)
  })

  it("includes the latest message, its classification, and the recommended action in the AI prompt", async () => {
    const { client } = seedHappyPath({
      message: {
        message_body: "How much would something like that cost?",
        intent: "REQUEST_FOR_PRICING",
        recommended_action: "Avoid quoting a number - propose a short call to scope it",
        recommended_action_reason: "They asked about price directly.",
      },
    })
    const ai = fakeAI(whatsappResponseOutput)

    await generateResponseDraft(client, ai, "conv-1", "user-1")

    const call = ai.generateStructuredOutput.mock.calls[0][1] as { prompt: string }
    expect(call.prompt).toContain("How much would something like that cost?")
    expect(call.prompt).toContain("REQUEST_FOR_PRICING")
    expect(call.prompt).toContain("Avoid quoting a number - propose a short call to scope it")
  })

  it("includes the original opportunity and sales strategy context in the AI prompt", async () => {
    const { client } = seedHappyPath()
    const ai = fakeAI(whatsappResponseOutput)

    await generateResponseDraft(client, ai, "conv-1", "user-1")

    const call = ai.generateStructuredOutput.mock.calls[0][1] as { prompt: string }
    expect(call.prompt).toContain("Online booking system")
    expect(call.prompt).toContain("No online booking")
  })

  it("includes prior conversation turns in the prompt via the shared transcript builder", async () => {
    const { client } = fakeSupabase({
      businesses: [business()],
      contacts: [contact()],
      conversations: [conversation()],
      inbound_messages: [
        inboundMessage({ id: "msg-0", message_body: "Hi, what do you do?", received_at: "2026-01-01T00:00:00.000Z" }),
        inboundMessage({ id: "msg-1", message_body: "Yes, we're interested. Can you tell me more about the booking system?" }),
      ],
      outreach_send_attempts: [
        {
          id: "attempt-0",
          outreach_draft_id: "draft-0",
          business_id: "biz-1",
          contact_id: "contact-1",
          conversation_id: "conv-1",
          channel: "WHATSAPP",
          provider: "whatsapp_cloud_api",
          recipient_address: "263771234567",
          sender_identity: "123",
          message_body: "Hi Jane, we build online booking systems at Zviko Labs - open to hearing an idea?",
          message_subject: null,
          status: "SENT",
          attempted_at: "2026-01-01T00:05:00.000Z",
          completed_at: "2026-01-01T00:05:00.000Z",
        },
      ],
      sales_strategies: [strategy()],
      opportunities: [opportunity()],
    })
    const ai = fakeAI(whatsappResponseOutput)

    await generateResponseDraft(client, ai, "conv-1", "user-1")

    const call = ai.generateStructuredOutput.mock.calls[0][1] as { prompt: string }
    expect(call.prompt).toContain("Hi, what do you do?")
    expect(call.prompt).toContain("open to hearing an idea?")
  })

  it("blocks generation and never calls the AI when the business is marked Do Not Contact", async () => {
    const { client } = seedHappyPath({ business: { do_not_contact: true } })
    const ai = fakeAI(whatsappResponseOutput)

    const result = await generateResponseDraft(client, ai, "conv-1", "user-1")

    expect(result.outcome).toBe("BLOCKED")
    if (result.outcome !== "BLOCKED") throw new Error("expected BLOCKED")
    expect(result.reason).toMatch(/opted out/i)
    expect(ai.generateStructuredOutput).not.toHaveBeenCalled()
  })

  it("blocks generation when the conversation itself is DO_NOT_CONTACT", async () => {
    const { client } = fakeSupabase({
      businesses: [business()],
      contacts: [contact()],
      conversations: [conversation({ status: "DO_NOT_CONTACT" })],
      inbound_messages: [inboundMessage()],
      sales_strategies: [strategy()],
      opportunities: [opportunity()],
    })
    const ai = fakeAI(whatsappResponseOutput)

    const result = await generateResponseDraft(client, ai, "conv-1", "user-1")

    expect(result.outcome).toBe("BLOCKED")
    expect(ai.generateStructuredOutput).not.toHaveBeenCalled()
  })

  it("blocks generation when the latest message's classified intent is OPT_OUT", async () => {
    const { client } = seedHappyPath({ message: { intent: "OPT_OUT" } })
    const ai = fakeAI(whatsappResponseOutput)

    const result = await generateResponseDraft(client, ai, "conv-1", "user-1")

    expect(result.outcome).toBe("BLOCKED")
    if (result.outcome !== "BLOCKED") throw new Error("expected BLOCKED")
    expect(result.reason).toMatch(/opted out/i)
    expect(ai.generateStructuredOutput).not.toHaveBeenCalled()
  })

  it("does NOT block generation for a WRONG_PERSON classification - it's a soft prompt instruction, not a hard stop", async () => {
    const { client } = seedHappyPath({ message: { intent: "WRONG_PERSON" } })
    const ai = fakeAI(whatsappResponseOutput)

    const result = await generateResponseDraft(client, ai, "conv-1", "user-1")

    expect(result.outcome).toBe("GENERATED")
    expect(ai.generateStructuredOutput).toHaveBeenCalledTimes(1)
  })

  it("blocks generation when there is no inbound message in the conversation yet", async () => {
    const { client } = fakeSupabase({
      businesses: [business()],
      contacts: [contact()],
      conversations: [conversation()],
      sales_strategies: [strategy()],
      opportunities: [opportunity()],
    })
    const ai = fakeAI(whatsappResponseOutput)

    const result = await generateResponseDraft(client, ai, "conv-1", "user-1")

    expect(result.outcome).toBe("BLOCKED")
    if (result.outcome !== "BLOCKED") throw new Error("expected BLOCKED")
    expect(result.reason).toMatch(/no inbound message/i)
    expect(ai.generateStructuredOutput).not.toHaveBeenCalled()
  })

  it("blocks generation while the latest message is still PENDING classification", async () => {
    const { client } = seedHappyPath({ message: { classification_status: "PENDING", intent: null } })
    const ai = fakeAI(whatsappResponseOutput)

    const result = await generateResponseDraft(client, ai, "conv-1", "user-1")

    expect(result.outcome).toBe("BLOCKED")
    if (result.outcome !== "BLOCKED") throw new Error("expected BLOCKED")
    expect(result.reason).toMatch(/hasn't finished/i)
    expect(ai.generateStructuredOutput).not.toHaveBeenCalled()
  })

  it("blocks generation and suggests reclassifying when classification FAILED", async () => {
    const { client } = seedHappyPath({ message: { classification_status: "FAILED", intent: null } })
    const ai = fakeAI(whatsappResponseOutput)

    const result = await generateResponseDraft(client, ai, "conv-1", "user-1")

    expect(result.outcome).toBe("BLOCKED")
    if (result.outcome !== "BLOCKED") throw new Error("expected BLOCKED")
    expect(result.reason).toMatch(/reclassify/i)
  })

  it("blocks generation and never invents an opportunity/strategy when none exists for this business", async () => {
    const { client } = fakeSupabase({
      businesses: [business()],
      contacts: [contact()],
      conversations: [conversation()],
      inbound_messages: [inboundMessage()],
    })
    const ai = fakeAI(whatsappResponseOutput)

    const result = await generateResponseDraft(client, ai, "conv-1", "user-1")

    expect(result.outcome).toBe("BLOCKED")
    if (result.outcome !== "BLOCKED") throw new Error("expected BLOCKED")
    expect(result.reason).toMatch(/no sales strategy/i)
    expect(ai.generateStructuredOutput).not.toHaveBeenCalled()
  })

  it("reuses an existing active draft for the same conversation+message+channel instead of calling the AI again", async () => {
    const { client, store } = seedHappyPath()
    const ai = fakeAI(whatsappResponseOutput)

    const first = await generateResponseDraft(client, ai, "conv-1", "user-1")
    const second = await generateResponseDraft(client, ai, "conv-1", "user-1")

    expect(second.outcome).toBe("REUSED")
    expect(ai.generateStructuredOutput).toHaveBeenCalledTimes(1)
    if (first.outcome !== "GENERATED" || second.outcome !== "REUSED") throw new Error("unexpected outcome")
    expect(second.drafts.map((d) => d.id).sort()).toEqual(first.drafts.map((d) => d.id).sort())
    expect(store.outreach_drafts).toHaveLength(2)
  })

  it("forceRegenerate creates a fresh round without deleting the prior drafts, logging RESPONSE_DRAFT_REGENERATED", async () => {
    const { client, store } = seedHappyPath()
    const ai = fakeAI(whatsappResponseOutput)

    const first = await generateResponseDraft(client, ai, "conv-1", "user-1")
    const second = await generateResponseDraft(client, ai, "conv-1", "user-1", true)

    expect(second.outcome).toBe("GENERATED")
    expect(ai.generateStructuredOutput).toHaveBeenCalledTimes(2)
    expect(store.outreach_drafts).toHaveLength(4)
    if (first.outcome !== "GENERATED") throw new Error("expected GENERATED")
    for (const draft of first.drafts) {
      expect(store.outreach_drafts.some((r) => r.id === draft.id)).toBe(true)
    }
    expect(store.activities.some((a) => a.activity_type === "RESPONSE_DRAFT_REGENERATED")).toBe(true)
  })

  it("marks a draft NEEDS_REVIEW when it fails validation (e.g. a fabricated price)", async () => {
    const { client } = seedHappyPath()
    const ai = fakeAI({
      variants: [
        {
          variant: "RECOMMENDED",
          body: "Sure - that package usually runs $499 and takes about 3 weeks.",
          rationale: "Answers their pricing question directly.",
        },
      ],
    })

    const result = await generateResponseDraft(client, ai, "conv-1", "user-1")

    expect(result.outcome).toBe("GENERATED")
    if (result.outcome !== "GENERATED") throw new Error("expected GENERATED")
    expect(result.drafts[0].validation_status).toBe("FAILED")
    expect(result.drafts[0].status).toBe("NEEDS_REVIEW")
    expect((result.drafts[0].validation_errors as { code: string }[]).some((i) => i.code === "UNSUPPORTED_STATISTIC")).toBe(true)
  })

  it("resolves an EMAIL response subject as Re: <the last email we actually sent in this conversation>, ignoring the AI's own subject", async () => {
    const { client } = fakeSupabase({
      businesses: [business()],
      contacts: [contact()],
      conversations: [conversation({ channel: "EMAIL" })],
      inbound_messages: [inboundMessage({ channel: "EMAIL" })],
      sales_strategies: [strategy({ recommended_channel: "EMAIL" })],
      opportunities: [opportunity()],
      outreach_send_attempts: [
        {
          id: "attempt-1",
          outreach_draft_id: "draft-0",
          business_id: "biz-1",
          contact_id: "contact-1",
          conversation_id: "conv-1",
          channel: "EMAIL",
          provider: "resend",
          recipient_address: "jane@abcgym.co.zw",
          sender_identity: "hello@zviko.com",
          message_body: "Hi Jane, quick idea for ABC Gym.",
          message_subject: "Quick idea for ABC Gym",
          status: "SENT",
          attempted_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        },
      ],
    })
    const ai = fakeAI(emailResponseOutput)

    const result = await generateResponseDraft(client, ai, "conv-1", "user-1")

    expect(result.outcome).toBe("GENERATED")
    if (result.outcome !== "GENERATED") throw new Error("expected GENERATED")
    expect(result.drafts[0].subject).toBe("Re: Quick idea for ABC Gym")
  })

  it("falls back to the inbound message's own subject metadata when there is no prior outbound email", async () => {
    const { client } = fakeSupabase({
      businesses: [business()],
      contacts: [contact()],
      conversations: [conversation({ channel: "EMAIL" })],
      inbound_messages: [inboundMessage({ channel: "EMAIL", metadata: { subject: "Question about your services" } })],
      sales_strategies: [strategy({ recommended_channel: "EMAIL" })],
      opportunities: [opportunity()],
    })
    const ai = fakeAI(emailResponseOutput)

    const result = await generateResponseDraft(client, ai, "conv-1", "user-1")

    expect(result.outcome).toBe("GENERATED")
    if (result.outcome !== "GENERATED") throw new Error("expected GENERATED")
    expect(result.drafts[0].subject).toBe("Re: Question about your services")
  })

  it("falls back to the AI's own subject only when no prior subject can be recovered at all", async () => {
    const { client } = fakeSupabase({
      businesses: [business()],
      contacts: [contact()],
      conversations: [conversation({ channel: "EMAIL" })],
      inbound_messages: [inboundMessage({ channel: "EMAIL", metadata: {} })],
      sales_strategies: [strategy({ recommended_channel: "EMAIL" })],
      opportunities: [opportunity()],
    })
    const ai = fakeAI(emailResponseOutput)

    const result = await generateResponseDraft(client, ai, "conv-1", "user-1")

    expect(result.outcome).toBe("GENERATED")
    if (result.outcome !== "GENERATED") throw new Error("expected GENERATED")
    expect(result.drafts[0].subject).toBe("booking system")
  })
})

describe("findActiveResponseDrafts / listResponseDraftsForConversation", () => {
  it("excludes CANCELLED drafts from the active/dedup set", async () => {
    const { client } = fakeSupabase({
      outreach_drafts: [
        { id: "d1", conversation_id: "conv-1", response_to_message_id: "msg-1", channel: "WHATSAPP", status: "CANCELLED", generated_at: new Date().toISOString() },
        { id: "d2", conversation_id: "conv-1", response_to_message_id: "msg-1", channel: "WHATSAPP", status: "DRAFT", generated_at: new Date().toISOString() },
      ],
    })

    const active = await findActiveResponseDrafts(client, "conv-1", "msg-1", "WHATSAPP")
    expect(active.map((d) => d.id)).toEqual(["d2"])
  })

  it("lists every response draft ever generated for a conversation, across rounds", async () => {
    const { client } = fakeSupabase({
      outreach_drafts: [
        { id: "d1", conversation_id: "conv-1", response_to_message_id: "msg-0", channel: "WHATSAPP", status: "SENT", generated_at: new Date().toISOString() },
        { id: "d2", conversation_id: "conv-1", response_to_message_id: "msg-1", channel: "WHATSAPP", status: "DRAFT", generated_at: new Date().toISOString() },
        { id: "d3", conversation_id: "conv-2", response_to_message_id: "msg-9", channel: "WHATSAPP", status: "DRAFT", generated_at: new Date().toISOString() },
      ],
    })

    const drafts = await listResponseDraftsForConversation(client, "conv-1")
    expect(drafts.map((d) => d.id).sort()).toEqual(["d1", "d2"])
  })
})
