import { describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { findDuplicate } from "./deduplication-service"
import type { Database, Tables } from "@/lib/types/database.types"

type FakeRow = { table: string; conditions: Record<string, unknown>; result: Tables<"businesses"> }

function fakeSupabase(rows: FakeRow[]): SupabaseClient<Database> {
  const client = {
    from(table: string) {
      const conditions: Record<string, unknown> = {}
      const builder = {
        select() {
          return builder
        },
        eq(column: string, value: unknown) {
          conditions[column] = value
          return builder
        },
        async maybeSingle() {
          const match = rows.find(
            (row) =>
              row.table === table &&
              Object.entries(row.conditions).every(([key, value]) => conditions[key] === value)
          )
          return { data: match ? match.result : null, error: null }
        },
      }
      return builder
    },
  }
  return client as unknown as SupabaseClient<Database>
}

function business(overrides: Partial<Tables<"businesses">> = {}): Tables<"businesses"> {
  return {
    id: "existing-id",
    name: "Existing Gym",
    name_normalized: "existing gym",
    industry: null,
    description: null,
    location: null,
    city: "Harare",
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
    last_researched_at: null,
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

describe("findDuplicate", () => {
  it("matches on an exact website, even with a different name", async () => {
    const existing = business({ website_normalized: "abcgym.co.zw" })
    const supabase = fakeSupabase([
      { table: "businesses", conditions: { website_normalized: "abcgym.co.zw" }, result: existing },
    ])

    const match = await findDuplicate(supabase, {
      name: "Completely Different Name",
      website: "https://www.abcgym.co.zw/",
    })
    expect(match?.reason).toBe("website")
    expect(match?.business.id).toBe("existing-id")
  })

  it("matches on an exact phone number", async () => {
    const existing = business({ phone_normalized: "+263771234567" })
    const supabase = fakeSupabase([
      { table: "businesses", conditions: { phone_normalized: "+263771234567" }, result: existing },
    ])

    const match = await findDuplicate(supabase, { name: "Some Gym", phone: "+263 77 123 4567" })
    expect(match?.reason).toBe("phone")
  })

  it("matches on normalized name only when the city also matches", async () => {
    const existing = business({ name_normalized: "abc gym", city: "Harare" })
    const supabase = fakeSupabase([
      {
        table: "businesses",
        conditions: { name_normalized: "abc gym", city: "Harare" },
        result: existing,
      },
    ])

    const match = await findDuplicate(supabase, { name: "ABC Gym", city: "Harare" })
    expect(match?.reason).toBe("name_and_city")
  })

  it("does not match on name alone without a city (spec: never merge on name similarity alone)", async () => {
    const supabase = fakeSupabase([])
    const match = await findDuplicate(supabase, { name: "ABC Gym" })
    expect(match).toBeNull()
  })

  it("returns null when nothing matches", async () => {
    const supabase = fakeSupabase([])
    const match = await findDuplicate(supabase, {
      name: "New Gym",
      website: "https://newgym.co.zw",
      phone: "+263700000000",
      city: "Bulawayo",
    })
    expect(match).toBeNull()
  })
})
