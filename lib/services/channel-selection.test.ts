import { describe, expect, it } from "vitest"

import { determineChannel } from "./channel-selection"
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

describe("determineChannel", () => {
  it("recommends WhatsApp when the contact has a number marked AVAILABLE", () => {
    const c = contact({ whatsapp_number: "+263771234567", whatsapp_status: "AVAILABLE" })
    const result = determineChannel(c, { whatsapp_status: "UNKNOWN", whatsapp_number: null, email: null })
    expect(result.channel).toBe("WHATSAPP")
  })

  it("never treats a phone number alone as WhatsApp - a plain phone with UNKNOWN whatsapp_status is not enough", () => {
    const c = contact({ phone: "+263771234567", whatsapp_number: null, whatsapp_status: "UNKNOWN" })
    const result = determineChannel(c, { whatsapp_status: "UNKNOWN", whatsapp_number: null, email: null })
    expect(result.channel).not.toBe("WHATSAPP")
  })

  it("never recommends WhatsApp when whatsapp_status is explicitly NOT_AVAILABLE, even with a number on file", () => {
    const c = contact({ whatsapp_number: "+263771234567", whatsapp_status: "NOT_AVAILABLE" })
    const result = determineChannel(c, { whatsapp_status: "NOT_AVAILABLE", whatsapp_number: "+263771234567", email: null })
    expect(result.channel).not.toBe("WHATSAPP")
  })

  it("falls back to the business's own WhatsApp when the contact has none but the business does", () => {
    const c = contact({ whatsapp_number: null, whatsapp_status: "UNKNOWN" })
    const result = determineChannel(c, { whatsapp_status: "AVAILABLE", whatsapp_number: "+263771234567", email: null })
    expect(result.channel).toBe("WHATSAPP")
  })

  it("recommends email when a contact email exists and no WhatsApp is available", () => {
    const c = contact({ email: "jane@biz.co.zw" })
    const result = determineChannel(c, { whatsapp_status: "UNKNOWN", whatsapp_number: null, email: null })
    expect(result.channel).toBe("EMAIL")
  })

  it("prefers WhatsApp over email when both are legitimately available", () => {
    const c = contact({ email: "jane@biz.co.zw", whatsapp_number: "+263771234567", whatsapp_status: "AVAILABLE" })
    const result = determineChannel(c, { whatsapp_status: "UNKNOWN", whatsapp_number: null, email: null })
    expect(result.channel).toBe("WHATSAPP")
  })

  it("returns NONE when there is no contact and the business has neither WhatsApp nor email", () => {
    const result = determineChannel(null, { whatsapp_status: "UNKNOWN", whatsapp_number: null, email: null })
    expect(result.channel).toBe("NONE")
  })
})
