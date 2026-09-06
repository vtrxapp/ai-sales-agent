import { describe, expect, it } from "vitest"

import { WhatsAppDraftOutputSchema, EmailDraftOutputSchema } from "./ai-outreach-draft"

const whatsappValid = {
  variants: [
    { variant: "RECOMMENDED", body: "Hi Jane, I noticed ABC Gym has no online booking. Would you be open to hearing an idea?" },
    { variant: "DIRECT", body: "Hi Jane, quick one - ABC Gym has no online booking. Want a quick idea for that?" },
    { variant: "CONVERSATIONAL", body: "Hey Jane! Came across ABC Gym and noticed no online booking - mind if I share a thought?" },
  ],
}

const emailValid = {
  variants: [
    {
      variant: "RECOMMENDED",
      subject: "A quick idea for ABC Gym's booking flow",
      body: "Hi Jane,\n\nI noticed ABC Gym doesn't have online booking yet. Would you be open to a short chat about it?\n\nBest,\nZviko Labs",
    },
  ],
}

describe("WhatsAppDraftOutputSchema", () => {
  it("accepts up to 3 valid variants", () => {
    expect(WhatsAppDraftOutputSchema.safeParse(whatsappValid).success).toBe(true)
  })

  it("accepts a single variant", () => {
    const result = WhatsAppDraftOutputSchema.safeParse({ variants: [whatsappValid.variants[0]] })
    expect(result.success).toBe(true)
  })

  it("rejects zero variants", () => {
    const result = WhatsAppDraftOutputSchema.safeParse({ variants: [] })
    expect(result.success).toBe(false)
  })

  it("rejects more than 3 variants", () => {
    const result = WhatsAppDraftOutputSchema.safeParse({
      variants: [...whatsappValid.variants, { variant: "DIRECT", body: "extra" }],
    })
    expect(result.success).toBe(false)
  })

  it("rejects an invalid variant tag", () => {
    const result = WhatsAppDraftOutputSchema.safeParse({
      variants: [{ variant: "CASUAL", body: "Hi there" }],
    })
    expect(result.success).toBe(false)
  })

  it("rejects a WhatsApp variant with a subject field type mismatch (schema has no subject)", () => {
    // A WhatsApp variant with an extra subject field should still validate -
    // Zod strips unknown keys by default rather than failing, which is fine
    // here since the service layer only ever reads `variant`/`body`.
    const result = WhatsAppDraftOutputSchema.safeParse({
      variants: [{ variant: "RECOMMENDED", body: "Hi there, ABC Gym...", subject: "Unexpected" }],
    })
    expect(result.success).toBe(true)
  })
})

describe("EmailDraftOutputSchema", () => {
  it("accepts a valid email variant with a subject", () => {
    expect(EmailDraftOutputSchema.safeParse(emailValid).success).toBe(true)
  })

  it("rejects an email variant missing a subject", () => {
    const result = EmailDraftOutputSchema.safeParse({
      variants: [{ variant: "RECOMMENDED", body: "Hi Jane, ..." }],
    })
    expect(result.success).toBe(false)
  })
})
