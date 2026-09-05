import { describe, expect, it } from "vitest"

import { normalizeBusinessName, normalizePhone, normalizeWebsite } from "./normalize"

describe("normalizeBusinessName", () => {
  it("lowercases and trims", () => {
    expect(normalizeBusinessName("  ABC Gym  ")).toBe("abc gym")
  })

  it("strips common punctuation", () => {
    expect(normalizeBusinessName("O'Brien's Restaurant, Inc.")).toBe("obriens restaurant inc")
  })

  it("collapses internal whitespace", () => {
    expect(normalizeBusinessName("ABC   Gym")).toBe("abc gym")
  })
})

describe("normalizeWebsite", () => {
  it("strips protocol and www", () => {
    expect(normalizeWebsite("https://www.AbcGym.co.zw")).toBe("abcgym.co.zw")
  })

  it("adds an implicit protocol when missing", () => {
    expect(normalizeWebsite("abcgym.co.zw")).toBe("abcgym.co.zw")
  })

  it("strips a trailing slash", () => {
    expect(normalizeWebsite("https://abcgym.co.zw/")).toBe("abcgym.co.zw")
  })

  it("keeps a meaningful path", () => {
    expect(normalizeWebsite("https://abcgym.co.zw/booking")).toBe("abcgym.co.zw/booking")
  })

  it("returns null for an empty string", () => {
    expect(normalizeWebsite("")).toBeNull()
  })

  it("returns null for an unparseable value", () => {
    expect(normalizeWebsite("not a url at all :: ///")).toBeNull()
  })
})

describe("normalizePhone", () => {
  it("strips formatting but keeps a leading +", () => {
    expect(normalizePhone("+263 77 123 4567")).toBe("+263771234567")
  })

  it("strips formatting without a leading +", () => {
    expect(normalizePhone("(077) 123-4567")).toBe("0771234567")
  })

  it("returns null for a string with no digits", () => {
    expect(normalizePhone("n/a")).toBeNull()
  })

  it("returns null for an empty string", () => {
    expect(normalizePhone("")).toBeNull()
  })
})
