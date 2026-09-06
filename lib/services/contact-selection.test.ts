import { describe, expect, it } from "vitest"

import { selectBestContact } from "./contact-selection"
import type { Tables } from "@/lib/types/database.types"

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

const noBusinessFallback = { whatsapp_number: null, whatsapp_status: "UNKNOWN" as const, email: null }

describe("selectBestContact", () => {
  it("prefers a verified decision-maker over everyone else", () => {
    const owner = contact({ id: "owner", name: "Owner Person", job_title: "Owner", verification_status: "VERIFIED" })
    const manager = contact({ id: "manager", name: "Manager Person", job_title: "Operations Manager" })
    const result = selectBestContact([manager, owner], noBusinessFallback)
    expect(result.tier).toBe("VERIFIED_DECISION_MAKER")
    expect(result.contact?.id).toBe("owner")
  })

  it("does not treat an unverified decision-maker as tier 1 - falls through to general contact", () => {
    const owner = contact({ id: "owner", job_title: "Founder", verification_status: "UNVERIFIED" })
    const result = selectBestContact([owner], noBusinessFallback)
    expect(result.tier).not.toBe("VERIFIED_DECISION_MAKER")
    expect(result.contact?.id).toBe("owner")
  })

  it("prefers a business manager over a general contact", () => {
    const manager = contact({ id: "manager", job_title: "Marketing Manager" })
    const general = contact({ id: "general", job_title: "Receptionist" })
    const result = selectBestContact([general, manager], noBusinessFallback)
    expect(result.tier).toBe("BUSINESS_MANAGER")
    expect(result.contact?.id).toBe("manager")
  })

  it("falls back to any contact on file when no decision-maker/manager exists", () => {
    const general = contact({ id: "general", job_title: "Receptionist" })
    const result = selectBestContact([general], noBusinessFallback)
    expect(result.tier).toBe("GENERAL_CONTACT")
    expect(result.contact?.id).toBe("general")
  })

  it("falls back to the business's own WhatsApp number when no contact exists", () => {
    const result = selectBestContact([], { whatsapp_number: "+263771234567", whatsapp_status: "AVAILABLE", email: null })
    expect(result.tier).toBe("BUSINESS_WHATSAPP")
    expect(result.contact).toBeNull()
  })

  it("does not use the business WhatsApp fallback when whatsapp_status is not AVAILABLE", () => {
    const result = selectBestContact([], { whatsapp_number: "+263771234567", whatsapp_status: "UNKNOWN", email: "info@biz.co.zw" })
    expect(result.tier).toBe("BUSINESS_EMAIL")
  })

  it("falls back to the business's own email when no WhatsApp is available", () => {
    const result = selectBestContact([], { whatsapp_number: null, whatsapp_status: "NOT_AVAILABLE", email: "info@biz.co.zw" })
    expect(result.tier).toBe("BUSINESS_EMAIL")
  })

  it("returns NONE and never fabricates a person when nothing usable exists", () => {
    const result = selectBestContact([], noBusinessFallback)
    expect(result.tier).toBe("NONE")
    expect(result.contact).toBeNull()
    expect(result.confidence).toBe(0)
  })
})
