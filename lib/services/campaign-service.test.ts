import { describe, expect, it } from "vitest"

import { emptyToNull } from "./campaign-service"

describe("emptyToNull", () => {
  it("converts an empty string to null", () => {
    expect(emptyToNull("")).toBeNull()
  })

  it("converts undefined to null", () => {
    expect(emptyToNull(undefined)).toBeNull()
  })

  it("passes through a non-empty string unchanged", () => {
    expect(emptyToNull("Harare")).toBe("Harare")
  })
})
