import { describe, expect, it, vi, beforeEach } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { sendOutreachMessage, retryOutreachSend, resolveRecipient } from "./outreach-send-service"
import { MockWhatsAppProvider, MockEmailProvider, MockFailingProvider } from "@/lib/outreach/mock-providers"
import { WhatsAppNotConfiguredError } from "@/lib/outreach/errors"
import type { Database, Tables } from "@/lib/types/database.types"

const getOutreachProviderMock = vi.fn()
vi.mock("@/lib/outreach", () => ({
  getOutreachProvider: (...args: unknown[]) => getOutreachProviderMock(...args),
}))

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
    whatsapp_number: "0771234567",
    whatsapp_status: "AVAILABLE",
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function draft(overrides: Partial<Tables<"outreach_drafts">> = {}): Tables<"outreach_drafts"> {
  return {
    id: "draft-1",
    business_id: "biz-1",
    contact_id: "contact-1",
    opportunity_id: "opp-1",
    sales_strategy_id: "strategy-1",
    channel: "WHATSAPP",
    message_type: "INITIAL_OUTREACH",
    variant: "RECOMMENDED",
    subject: null,
    body: "Hi Jane, want an idea from Zviko Labs?",
    personalization_score: 80,
    personalization_reasoning: {},
    validation_status: "PASSED",
    validation_errors: [],
    status: "READY_TO_SEND",
    is_user_edited: false,
    model: "fake-model",
    generated_at: new Date().toISOString(),
    approved_at: new Date().toISOString(),
    approved_by: "user-1",
    created_by: "user-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

type Store = Record<string, Record<string, unknown>[]>

function fakeSupabase(seed: Partial<Store>) {
  const store: Store = {
    businesses: [],
    contacts: [],
    outreach_drafts: [],
    outreach_send_attempts: [],
    activities: [],
    ...seed,
  }
  let nextId = 1

  const client = {
    from(table: string) {
      const filters: [string, unknown][] = []
      let mode: "select" | "insert" | "update" = "select"
      let payload: Record<string, unknown> | null = null

      function matchRows(): Record<string, unknown>[] {
        return (store[table] ?? []).filter((r) => filters.every(([c, v]) => r[c] === v))
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
        then(resolveFn: (v: { data: Record<string, unknown>[]; error: null }) => void) {
          resolveFn({ data: matchRows(), error: null })
        },
      }

      function resolve(allowEmpty: boolean): { data: Record<string, unknown> | null; error: { message: string } | null } {
        if (mode === "insert" && payload) {
          // Simulates the real DB's unique partial index: at most one
          // PENDING outreach_send_attempts row per draft.
          if (table === "outreach_send_attempts" && payload.status === "PENDING") {
            const conflict = (store[table] ?? []).some(
              (r) => r.outreach_draft_id === payload!.outreach_draft_id && r.status === "PENDING"
            )
            if (conflict) {
              return {
                data: null,
                error: { message: 'duplicate key value violates unique constraint "outreach_send_attempts_one_pending_per_draft"' },
              }
            }
          }
          const row = {
            id: `generated-${nextId++}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...payload,
          }
          store[table].push(row)
          return { data: row, error: null }
        }
        if (mode === "update" && payload) {
          const row = matchRows()[0]
          if (!row) return allowEmpty ? { data: null, error: null } : { data: null, error: { message: "not found" } }
          Object.assign(row, payload)
          return { data: row, error: null }
        }
        const rows = matchRows()
        if (rows[0]) return { data: rows[0], error: null }
        return allowEmpty ? { data: null, error: null } : { data: null, error: { message: "not found" } }
      }

      return builder
    },
  }

  return { client: client as unknown as SupabaseClient<Database>, store }
}

describe("resolveRecipient", () => {
  it("prefers the contact's WhatsApp number when marked available", () => {
    const result = resolveRecipient("WHATSAPP", contact(), business())
    expect(result).toEqual({ name: "Jane Doe", phone: "0771234567" })
  })

  it("never treats a phone number as WhatsApp-capable without an explicit AVAILABLE status", () => {
    const result = resolveRecipient(
      "WHATSAPP",
      contact({ whatsapp_status: "UNKNOWN" }),
      business({ whatsapp_status: "UNKNOWN" })
    )
    expect(result).toBeNull()
  })

  it("falls back to the business's own WhatsApp number when there's no contact", () => {
    const result = resolveRecipient("WHATSAPP", null, business({ whatsapp_status: "AVAILABLE", whatsapp_number: "0779999999" }))
    expect(result).toEqual({ name: null, phone: "0779999999" })
  })

  it("prefers the contact's email for the EMAIL channel", () => {
    const result = resolveRecipient("EMAIL", contact(), business({ email: "info@abcgym.co.zw" }))
    expect(result).toEqual({ name: "Jane Doe", email: "jane@abcgym.co.zw" })
  })

  it("falls back to the business email when the contact has none", () => {
    const result = resolveRecipient("EMAIL", contact({ email: null }), business({ email: "info@abcgym.co.zw" }))
    expect(result).toEqual({ name: null, email: "info@abcgym.co.zw" })
  })
})

describe("sendOutreachMessage", () => {
  beforeEach(() => {
    getOutreachProviderMock.mockReset()
  })

  it("sends a READY_TO_SEND draft and moves it to SENT with a persisted attempt", async () => {
    getOutreachProviderMock.mockReturnValue(new MockWhatsAppProvider())
    const { client, store } = fakeSupabase({ businesses: [business()], contacts: [contact()], outreach_drafts: [draft()] })

    const outcome = await sendOutreachMessage(client, "draft-1", "user-1")

    expect(outcome.outcome).toBe("SENT")
    if (outcome.outcome !== "SENT") throw new Error("expected SENT")
    expect(outcome.draft.status).toBe("SENT")
    expect(outcome.sendAttempt.status).toBe("SENT")
    expect(outcome.sendAttempt.provider_message_id).toMatch(/^wamid_MOCK_SENT_/)
    expect(outcome.sendAttempt.message_body).toBe(draft().body)
    expect(outcome.sendAttempt.recipient_address).toBe("0771234567")
    expect(store.activities.map((a) => a.activity_type)).toEqual(
      expect.arrayContaining(["OUTREACH_SEND_ATTEMPTED", "OUTREACH_SENT"])
    )
  })

  it("persists a FAILED attempt and moves the draft to FAILED when the provider rejects it", async () => {
    getOutreachProviderMock.mockReturnValue(
      new MockFailingProvider("WHATSAPP", { retryable: false, errorCode: "131026", errorMessage: "Number not on WhatsApp." })
    )
    const { client } = fakeSupabase({ businesses: [business()], contacts: [contact()], outreach_drafts: [draft()] })

    const outcome = await sendOutreachMessage(client, "draft-1", "user-1")

    expect(outcome.outcome).toBe("FAILED")
    if (outcome.outcome !== "FAILED") throw new Error("expected FAILED")
    expect(outcome.draft.status).toBe("FAILED")
    expect(outcome.sendAttempt.retryable).toBe(false)
    expect(outcome.sendAttempt.error_message).toBe("Number not on WhatsApp.")
  })

  it("never sends a DRAFT-status message - approval is mandatory", async () => {
    const { client } = fakeSupabase({ businesses: [business()], contacts: [contact()], outreach_drafts: [draft({ status: "DRAFT" })] })

    const outcome = await sendOutreachMessage(client, "draft-1", "user-1")

    expect(outcome.outcome).toBe("BLOCKED")
    expect(getOutreachProviderMock).not.toHaveBeenCalled()
  })

  it("never sends a draft that failed validation, even if its status looks sendable", async () => {
    const { client } = fakeSupabase({
      businesses: [business()],
      contacts: [contact()],
      outreach_drafts: [draft({ validation_status: "FAILED" })],
    })

    const outcome = await sendOutreachMessage(client, "draft-1", "user-1")

    expect(outcome.outcome).toBe("BLOCKED")
    expect(getOutreachProviderMock).not.toHaveBeenCalled()
  })

  it("blocks sending when the business is marked Do Not Contact", async () => {
    const { client } = fakeSupabase({
      businesses: [business({ do_not_contact: true, do_not_contact_reason: "Asked not to be contacted" })],
      contacts: [contact()],
      outreach_drafts: [draft()],
    })

    const outcome = await sendOutreachMessage(client, "draft-1", "user-1")

    expect(outcome.outcome).toBe("BLOCKED")
    if (outcome.outcome !== "BLOCKED") throw new Error("expected BLOCKED")
    expect(outcome.reason).toMatch(/do not contact/i)
    expect(getOutreachProviderMock).not.toHaveBeenCalled()
  })

  it("blocks sending and gives a clear reason when the provider isn't configured", async () => {
    getOutreachProviderMock.mockImplementation(() => {
      throw new WhatsAppNotConfiguredError()
    })
    const { client } = fakeSupabase({ businesses: [business()], contacts: [contact()], outreach_drafts: [draft()] })

    const outcome = await sendOutreachMessage(client, "draft-1", "user-1")

    expect(outcome.outcome).toBe("BLOCKED")
    if (outcome.outcome !== "BLOCKED") throw new Error("expected BLOCKED")
    expect(outcome.reason).toMatch(/WHATSAPP_ACCESS_TOKEN/)
  })

  it("blocks sending when no valid recipient exists any more, even though the draft is READY_TO_SEND", async () => {
    getOutreachProviderMock.mockReturnValue(new MockWhatsAppProvider())
    const { client } = fakeSupabase({
      businesses: [business()],
      contacts: [contact({ whatsapp_status: "NOT_AVAILABLE", whatsapp_number: null })],
      outreach_drafts: [draft()],
    })

    const outcome = await sendOutreachMessage(client, "draft-1", "user-1")

    expect(outcome.outcome).toBe("BLOCKED")
    expect(getOutreachProviderMock).not.toHaveBeenCalled()
  })

  it("is idempotent: a second concurrent send attempt on the same draft never sends twice", async () => {
    getOutreachProviderMock.mockReturnValue(new MockWhatsAppProvider())
    const { client, store } = fakeSupabase({ businesses: [business()], contacts: [contact()], outreach_drafts: [draft()] })

    const [first, second] = await Promise.all([
      sendOutreachMessage(client, "draft-1", "user-1"),
      sendOutreachMessage(client, "draft-1", "user-1"),
    ])

    const outcomes = [first.outcome, second.outcome]
    // Exactly one attempt actually sends; the other is stopped by either
    // the optimistic status lock (BLOCKED) or, if it arrives after the
    // first fully completed, the ALREADY_SENT replay path - both are
    // safe outcomes. What must never happen is two real sends.
    expect(outcomes.filter((o) => o === "SENT")).toHaveLength(1)
    expect(outcomes.filter((o) => o === "BLOCKED" || o === "ALREADY_SENT")).toHaveLength(1)
    expect(store.outreach_send_attempts.filter((a) => a.status === "SENT")).toHaveLength(1)
  })

  it("replays ALREADY_SENT rather than erroring when called again on an already-SENT draft", async () => {
    const sentAttempt = {
      id: "attempt-1",
      outreach_draft_id: "draft-1",
      business_id: "biz-1",
      contact_id: "contact-1",
      channel: "WHATSAPP",
      provider: "whatsapp_cloud_api",
      recipient_address: "0771234567",
      sender_identity: "123",
      message_body: "hi",
      message_subject: null,
      status: "SENT",
      provider_message_id: "wamid.abc",
      retryable: null,
      error_code: null,
      error_message: null,
      metadata: {},
      attempted_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      created_by: "user-1",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const { client } = fakeSupabase({
      businesses: [business()],
      contacts: [contact()],
      outreach_drafts: [draft({ status: "SENT" })],
      outreach_send_attempts: [sentAttempt],
    })

    const outcome = await sendOutreachMessage(client, "draft-1", "user-1")

    expect(outcome.outcome).toBe("ALREADY_SENT")
    expect(getOutreachProviderMock).not.toHaveBeenCalled()
  })

  it("sends an EMAIL draft using the resolved email recipient", async () => {
    getOutreachProviderMock.mockReturnValue(new MockEmailProvider())
    const { client } = fakeSupabase({
      businesses: [business()],
      contacts: [contact({ email: "jane@abcgym.co.zw" })],
      outreach_drafts: [draft({ channel: "EMAIL", subject: "Quick idea" })],
    })

    const outcome = await sendOutreachMessage(client, "draft-1", "user-1")

    expect(outcome.outcome).toBe("SENT")
    if (outcome.outcome !== "SENT") throw new Error("expected SENT")
    expect(outcome.sendAttempt.recipient_address).toBe("jane@abcgym.co.zw")
    expect(outcome.sendAttempt.message_subject).toBe("Quick idea")
  })
})

describe("retryOutreachSend", () => {
  beforeEach(() => {
    getOutreachProviderMock.mockReset()
  })

  it("retries a retryable FAILED draft and can succeed", async () => {
    getOutreachProviderMock.mockReturnValue(new MockWhatsAppProvider())
    const failedAttempt = {
      id: "attempt-1",
      outreach_draft_id: "draft-1",
      business_id: "biz-1",
      contact_id: "contact-1",
      channel: "WHATSAPP",
      provider: "whatsapp_cloud_api",
      recipient_address: "0771234567",
      sender_identity: "123",
      message_body: "hi",
      message_subject: null,
      status: "FAILED",
      provider_message_id: null,
      retryable: true,
      error_code: "500",
      error_message: "Temporary problem.",
      metadata: {},
      attempted_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      created_by: "user-1",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const { client } = fakeSupabase({
      businesses: [business()],
      contacts: [contact()],
      outreach_drafts: [draft({ status: "FAILED" })],
      outreach_send_attempts: [failedAttempt],
    })

    const outcome = await retryOutreachSend(client, "draft-1", "user-1")

    expect(outcome.outcome).toBe("SENT")
  })

  it("refuses to retry a non-retryable failure", async () => {
    const failedAttempt = {
      id: "attempt-1",
      outreach_draft_id: "draft-1",
      business_id: "biz-1",
      contact_id: "contact-1",
      channel: "WHATSAPP",
      provider: "whatsapp_cloud_api",
      recipient_address: "0771234567",
      sender_identity: "123",
      message_body: "hi",
      message_subject: null,
      status: "FAILED",
      provider_message_id: null,
      retryable: false,
      error_code: "131026",
      error_message: "Number not on WhatsApp.",
      metadata: {},
      attempted_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      created_by: "user-1",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const { client, store } = fakeSupabase({
      businesses: [business()],
      contacts: [contact()],
      outreach_drafts: [draft({ status: "FAILED" })],
      outreach_send_attempts: [failedAttempt],
    })

    const outcome = await retryOutreachSend(client, "draft-1", "user-1")

    expect(outcome.outcome).toBe("BLOCKED")
    expect(getOutreachProviderMock).not.toHaveBeenCalled()
    expect(store.outreach_drafts[0].status).toBe("FAILED")
  })

  it("refuses to retry a draft that was never sent", async () => {
    const { client } = fakeSupabase({ businesses: [business()], contacts: [contact()], outreach_drafts: [draft({ status: "READY_TO_SEND" })] })

    const outcome = await retryOutreachSend(client, "draft-1", "user-1")

    expect(outcome.outcome).toBe("BLOCKED")
    expect(getOutreachProviderMock).not.toHaveBeenCalled()
  })
})
