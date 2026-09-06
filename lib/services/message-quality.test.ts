import { describe, expect, it } from "vitest"

import { validateMessage, computePersonalizationScore, type MessageQualityContext } from "./message-quality"

function context(overrides: Partial<MessageQualityContext> = {}): MessageQualityContext {
  return {
    channel: "WHATSAPP",
    businessName: "ABC Gym",
    contactName: "Jane Doe",
    opportunityTitle: "No online booking",
    opportunityType: "BOOKING_SYSTEM",
    recommendedService: "Online booking system",
    evidenceText: "The website has no visible booking form; customers must call to book a class.",
    industry: "Fitness",
    city: "Harare",
    country: "Zimbabwe",
    subject: null,
    body: "Hi Jane, I came across ABC Gym while researching gyms in Harare. I noticed there's no online booking form on the site - customers must call to book a class. We build an online booking system at Zviko Labs and thought this could make registering for classes easier. Would you be open to hearing the idea?",
    ...overrides,
  }
}

describe("validateMessage", () => {
  it("passes a well-formed, evidence-grounded message", () => {
    const result = validateMessage(context())
    expect(result.status).toBe("PASSED")
    expect(result.issues).toEqual([])
  })

  it("fails when the business name never appears", () => {
    const result = validateMessage(context({ body: "Hi Jane, I noticed you don't have online booking. We could help." }))
    expect(result.status).toBe("FAILED")
    expect(result.issues.some((i) => i.code === "MISSING_BUSINESS_NAME")).toBe(true)
  })

  it("fails when a named contact is never addressed by name", () => {
    const result = validateMessage(
      context({ body: "Hi there, ABC Gym doesn't have online booking - customers must call to book a class. We could help with that." })
    )
    expect(result.issues.some((i) => i.code === "CONTACT_NAME_MISMATCH")).toBe(true)
  })

  it("fails on an unfilled template placeholder", () => {
    const result = validateMessage(context({ body: "Hi [Name], I noticed [Business] has no online booking. Interested?" }))
    expect(result.issues.some((i) => i.code === "UNFILLED_PLACEHOLDER")).toBe(true)
  })

  it("fails on excessive length for a WhatsApp message", () => {
    const result = validateMessage(context({ body: "Hi Jane, ABC Gym has no online booking. ".repeat(30) }))
    expect(result.issues.some((i) => i.code === "EXCESSIVE_LENGTH")).toBe(true)
  })

  it("fails on generic sales language", () => {
    const result = validateMessage(
      context({
        body: "Hi Jane, I hope this email finds you well. ABC Gym could use our innovative digital solutions to grow.",
      })
    )
    expect(result.issues.some((i) => i.code === "GENERIC_LANGUAGE")).toBe(true)
  })

  it("fails when the message contains a URL", () => {
    const result = validateMessage(
      context({ body: "Hi Jane, ABC Gym has no online booking - check https://example.com/promo for more." })
    )
    expect(result.issues.some((i) => i.code === "SUSPICIOUS_URL")).toBe(true)
  })

  it("fails on a numeric claim not traceable to the recorded evidence", () => {
    const result = validateMessage(
      context({ body: "Hi Jane, ABC Gym could increase bookings by 47% with online booking - happy to share how." })
    )
    expect(result.issues.some((i) => i.code === "UNSUPPORTED_STATISTIC")).toBe(true)
  })

  it("fails when the message never references anything from the recorded evidence", () => {
    const result = validateMessage(
      context({
        body: "Hi Jane, ABC Gym seems like a great business in Harare. Would you be open to a quick chat about growth?",
        evidenceText: "The website has no visible booking form; customers must call to book a class.",
      })
    )
    expect(result.issues.some((i) => i.code === "MISSING_EVIDENCE_ANCHOR")).toBe(true)
  })

  it("requires a subject line for an email draft", () => {
    const result = validateMessage(context({ channel: "EMAIL", subject: null }))
    expect(result.issues.some((i) => i.code === "MISSING_SUBJECT")).toBe(true)
  })
})

describe("computePersonalizationScore", () => {
  it("scores a fully personalized, evidence-grounded message highly", () => {
    const result = computePersonalizationScore(context())
    expect(result.score).toBeGreaterThanOrEqual(80)
    expect(result.breakdown.business_name_reference).toBeGreaterThan(0)
    expect(result.breakdown.evidence_specific_reference).toBeGreaterThan(0)
  })

  it("scores near 0 for a fully generic message with no personalization signals", () => {
    const result = computePersonalizationScore(
      context({
        businessName: "ABC Gym",
        contactName: null,
        body: "Hello, we offer innovative digital solutions. Let us know if interested.",
      })
    )
    expect(result.score).toBeLessThan(10)
  })

  it("applies a generic-language penalty that reduces the score", () => {
    const clean = computePersonalizationScore(context())
    const withGenericLanguage = computePersonalizationScore(
      context({
        body: `${context().body} I hope this email finds you well and offer innovative digital solutions.`,
      })
    )
    expect(withGenericLanguage.breakdown.generic_language_penalty).toBeGreaterThan(0)
    expect(withGenericLanguage.score).toBeLessThan(clean.score)
  })

  it("gives partial credit for contact personalization when there is no named contact to personalize to", () => {
    const result = computePersonalizationScore(context({ contactName: null }))
    expect(result.breakdown.contact_personalization).toBeGreaterThan(0)
    expect(result.breakdown.contact_personalization).toBeLessThan(10)
  })

  it("never returns a score outside 0-100", () => {
    const result = computePersonalizationScore(context({ body: "hi" }))
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it("is deterministic - the same input always produces the same score", () => {
    const first = computePersonalizationScore(context())
    const second = computePersonalizationScore(context())
    expect(first.score).toBe(second.score)
  })
})
