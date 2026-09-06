import { describe, expect, it } from "vitest"

import { normalizePhoneForSending, ZIMBABWE } from "./phone-normalization"

describe("normalizePhoneForSending", () => {
  it("accepts a local Zimbabwe number with the 0 trunk prefix", () => {
    const result = normalizePhoneForSending("0771234567")
    expect(result).toEqual({ valid: true, whatsappFormat: "263771234567", e164: "+263771234567", country: "Zimbabwe" })
  })

  it("accepts an international +263 number", () => {
    const result = normalizePhoneForSending("+263771234567")
    expect(result).toEqual({ valid: true, whatsappFormat: "263771234567", e164: "+263771234567", country: "Zimbabwe" })
  })

  it("accepts a 263-prefixed number with no leading +", () => {
    const result = normalizePhoneForSending("263771234567")
    expect(result).toEqual({ valid: true, whatsappFormat: "263771234567", e164: "+263771234567", country: "Zimbabwe" })
  })

  it("accepts a bare national significant number with no prefix", () => {
    const result = normalizePhoneForSending("771234567")
    expect(result).toEqual({ valid: true, whatsappFormat: "263771234567", e164: "+263771234567", country: "Zimbabwe" })
  })

  it("tolerates spaces, dashes, dots, and parentheses", () => {
    const result = normalizePhoneForSending("+263 (77) 123-4567")
    expect(result.valid).toBe(true)
  })

  it("rejects a number that's too short", () => {
    const result = normalizePhoneForSending("07712345")
    expect(result.valid).toBe(false)
  })

  it("rejects a number that's too long", () => {
    const result = normalizePhoneForSending("077123456789")
    expect(result.valid).toBe(false)
  })

  it("rejects letters and other garbage", () => {
    const result = normalizePhoneForSending("call-me-maybe")
    expect(result.valid).toBe(false)
  })

  it("rejects an empty or whitespace-only value", () => {
    expect(normalizePhoneForSending("").valid).toBe(false)
    expect(normalizePhoneForSending("   ").valid).toBe(false)
  })

  it("never mutates the original input string", () => {
    const raw = " 0771234567 "
    normalizePhoneForSending(raw)
    expect(raw).toBe(" 0771234567 ")
  })

  it("does not blindly prepend a country code to an already-international number missing a digit", () => {
    // 8-digit "national number" prefixed with 263 would be 11 digits total,
    // one short of the real 9-digit NSN - must be rejected, not padded.
    const result = normalizePhoneForSending("26377123456")
    expect(result.valid).toBe(false)
  })

  it("falls through to an explicit rejection reason naming the supported countries when nothing matches", () => {
    const result = normalizePhoneForSending("12345", [ZIMBABWE])
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toContain("Zimbabwe")
  })
})
