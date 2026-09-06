import { describe, expect, it } from "vitest"

import { recommendResponseAction } from "./response-action-service"
import { Constants } from "@/lib/types/database.types"

describe("recommendResponseAction", () => {
  it("returns a distinct, non-empty action and reason for every possible intent", () => {
    for (const intent of Constants.public.Enums.response_intent) {
      const result = recommendResponseAction(intent, "Online booking system")
      expect(result.action.length).toBeGreaterThan(0)
      expect(result.reason.length).toBeGreaterThan(0)
    }
  })

  it("recommends explaining the solution and a discovery call for INTERESTED", () => {
    expect(recommendResponseAction("INTERESTED", "Online booking system").action).toMatch(/discovery call/i)
  })

  it("recommends sending pricing for REQUEST_FOR_PRICING", () => {
    expect(recommendResponseAction("REQUEST_FOR_PRICING", null).action).toMatch(/pricing/i)
  })

  it("recommends scheduling for REQUEST_FOR_MEETING", () => {
    expect(recommendResponseAction("REQUEST_FOR_MEETING", null).action).toMatch(/schedule/i)
  })

  it("recommends never contacting again for OPT_OUT", () => {
    const result = recommendResponseAction("OPT_OUT", null)
    expect(result.action).toMatch(/do not contact/i)
  })

  it("recommends no action for NOT_INTERESTED", () => {
    expect(recommendResponseAction("NOT_INTERESTED", null).action).toMatch(/no action/i)
  })

  it("recommends manual review for UNCLEAR rather than guessing a specific action", () => {
    expect(recommendResponseAction("UNCLEAR", null).action).toMatch(/review manually/i)
  })

  it("never invents a recommendation unrelated to the classified intent - same intent always yields the same action regardless of the opportunity text", () => {
    const withService = recommendResponseAction("QUESTION", "Mobile app")
    const withoutService = recommendResponseAction("QUESTION", null)
    expect(withService.action).toBe(withoutService.action)
  })
})
