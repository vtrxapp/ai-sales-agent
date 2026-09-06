import { describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { matchInboundSender, findOrCreateConversation } from "./response-matching-service"
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
  const store: Store = { businesses: [], contacts: [], conversations: [], outreach_send_attempts: [], ...seed }
  let nextId = 1

  const client = {
    from(table: string) {
      const filters: [string, unknown, "eq" | "not_null"][] = []
      let mode: "select" | "insert" | "update" = "select"
      let payload: Record<string, unknown> | null = null

      function matchRows(): Record<string, unknown>[] {
        return (store[table] ?? []).filter((r) =>
          filters.every(([c, v, kind]) => (kind === "not_null" ? r[c] !== null && r[c] !== undefined : r[c] === v))
        )
      }

      const builder = {
        select() {
          return builder
        },
        eq(col: string, val: unknown) {
          filters.push([col, val, "eq"])
          return builder
        },
        not(col: string) {
          filters.push([col, null, "not_null"])
          return builder
        },
        is(col: string, val: unknown) {
          filters.push([col, val, "eq"])
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
        // A bare `await` on the query builder (no .single()/.maybeSingle())
        // goes through this thenable, not resolve() - update/insert must
        // apply their mutation here too, or a call site like
        // findOrCreateConversation's backfill (awaited directly, no
        // .select()) would silently never touch the store.
        then(resolveFn: (v: { data: Record<string, unknown>[] | null; error: null }) => void) {
          if (mode === "insert" && payload) {
            const row = { id: `generated-${nextId++}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...payload }
            store[table].push(row)
            resolveFn({ data: [row], error: null })
            return
          }
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

describe("matchInboundSender - WHATSAPP", () => {
  it("matches a contact whose WhatsApp number is stored in a different raw format than the inbound sender", async () => {
    const { client } = fakeSupabase({
      contacts: [contact({ whatsapp_number: "0771234567" })],
      businesses: [business()],
    })

    const result = await matchInboundSender(client, "WHATSAPP", "263771234567")
    expect(result?.business.id).toBe("biz-1")
    expect(result?.contact?.id).toBe("contact-1")
  })

  it("falls back to the business's own WhatsApp number when no contact matches", async () => {
    const { client } = fakeSupabase({
      contacts: [],
      businesses: [business({ whatsapp_number: "+263779999999" })],
    })

    const result = await matchInboundSender(client, "WHATSAPP", "0779999999")
    expect(result?.business.id).toBe("biz-1")
    expect(result?.contact).toBeNull()
  })

  it("returns null - never guesses - when no contact or business matches", async () => {
    const { client } = fakeSupabase({
      contacts: [contact({ whatsapp_number: "0771234567" })],
      businesses: [business()],
    })

    const result = await matchInboundSender(client, "WHATSAPP", "0770000000")
    expect(result).toBeNull()
  })

  it("returns null for an unparseable sender number rather than matching arbitrarily", async () => {
    const { client } = fakeSupabase({ contacts: [contact({ whatsapp_number: "0771234567" })], businesses: [business()] })
    const result = await matchInboundSender(client, "WHATSAPP", "not-a-number")
    expect(result).toBeNull()
  })
})

describe("matchInboundSender - EMAIL", () => {
  it("matches a contact by email, case-insensitively", async () => {
    const { client } = fakeSupabase({
      contacts: [contact({ email: "Jane@AbcGym.co.zw" })],
      businesses: [business()],
    })

    const result = await matchInboundSender(client, "EMAIL", "jane@abcgym.co.zw")
    expect(result?.contact?.id).toBe("contact-1")
  })

  it("falls back to the business's own email when no contact matches", async () => {
    const { client } = fakeSupabase({ contacts: [], businesses: [business({ email: "info@abcgym.co.zw" })] })
    const result = await matchInboundSender(client, "EMAIL", "info@abcgym.co.zw")
    expect(result?.business.id).toBe("biz-1")
    expect(result?.contact).toBeNull()
  })

  it("returns null when no address matches", async () => {
    const { client } = fakeSupabase({ contacts: [], businesses: [business({ email: "info@abcgym.co.zw" })] })
    const result = await matchInboundSender(client, "EMAIL", "someone-else@example.com")
    expect(result).toBeNull()
  })
})

describe("findOrCreateConversation", () => {
  it("creates a new conversation when none exists for this business+channel", async () => {
    const { client, store } = fakeSupabase({})
    const conversation = await findOrCreateConversation(client, "biz-1", "contact-1", "WHATSAPP", "whatsapp_cloud_api")
    expect(conversation.business_id).toBe("biz-1")
    expect(conversation.channel).toBe("WHATSAPP")
    expect(store.conversations).toHaveLength(1)
  })

  it("returns the existing conversation instead of creating a duplicate", async () => {
    const { client, store } = fakeSupabase({})
    const first = await findOrCreateConversation(client, "biz-1", "contact-1", "WHATSAPP", "whatsapp_cloud_api")
    const second = await findOrCreateConversation(client, "biz-1", "contact-1", "WHATSAPP", "whatsapp_cloud_api")
    expect(second.id).toBe(first.id)
    expect(store.conversations).toHaveLength(1)
  })

  it("backfills prior outreach_send_attempts for this business+channel into the new conversation", async () => {
    const { client, store } = fakeSupabase({
      outreach_send_attempts: [
        { id: "attempt-1", business_id: "biz-1", channel: "WHATSAPP", conversation_id: null, status: "SENT" },
        { id: "attempt-2", business_id: "biz-1", channel: "EMAIL", conversation_id: null, status: "SENT" },
      ],
    })

    const conversation = await findOrCreateConversation(client, "biz-1", null, "WHATSAPP", "whatsapp_cloud_api")

    const whatsappAttempt = store.outreach_send_attempts.find((a) => a.id === "attempt-1")
    const emailAttempt = store.outreach_send_attempts.find((a) => a.id === "attempt-2")
    expect(whatsappAttempt?.conversation_id).toBe(conversation.id)
    expect(emailAttempt?.conversation_id).toBeNull()
  })
})
