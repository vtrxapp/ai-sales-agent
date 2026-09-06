import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

import { WhatsAppCloudApiProvider, classifyWhatsAppError, DEFAULT_WHATSAPP_API_VERSION } from "./whatsapp-provider"
import type { Tables } from "@/lib/types/database.types"

function draft(overrides: Partial<Tables<"outreach_drafts">> = {}): Tables<"outreach_drafts"> {
  return {
    id: "draft-1",
    business_id: "biz-1",
    contact_id: "contact-1",
    opportunity_id: "opp-1",
    sales_strategy_id: "strategy-1",
    channel: "WHATSAPP",
    message_type: "INITIAL_OUTREACH",
    variant: "RECOMMENDED",
    subject: null,
    body: "Hi Jane, want an idea from Zviko Labs?",
    personalization_score: 80,
    personalization_reasoning: {},
    validation_status: "PASSED",
    validation_errors: [],
    status: "READY_TO_SEND",
    is_user_edited: false,
    model: "fake-model",
    generated_at: new Date().toISOString(),
    approved_at: new Date().toISOString(),
    approved_by: "user-1",
    created_by: "user-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

describe("classifyWhatsAppError", () => {
  it("treats 429 as retryable", () => {
    expect(classifyWhatsAppError(429, undefined).retryable).toBe(true)
  })

  it("treats 5xx as retryable", () => {
    expect(classifyWhatsAppError(500, undefined).retryable).toBe(true)
  })

  it("treats an undeliverable number (131026) as non-retryable", () => {
    const result = classifyWhatsAppError(400, { code: 131026 })
    expect(result.retryable).toBe(false)
    expect(result.errorMessage).toMatch(/not be delivered/i)
  })

  it("treats a missing/unapproved template (132001) as non-retryable", () => {
    const result = classifyWhatsAppError(400, { code: 132001 })
    expect(result.retryable).toBe(false)
    expect(result.errorMessage).toMatch(/template/i)
  })

  it("treats an outside-window rejection (131047) as non-retryable", () => {
    const result = classifyWhatsAppError(400, { code: 131047 })
    expect(result.retryable).toBe(false)
  })

  it("treats a bad access token (190) as non-retryable", () => {
    const result = classifyWhatsAppError(401, { code: 190 })
    expect(result.retryable).toBe(false)
    expect(result.errorMessage).toMatch(/access token/i)
  })

  it("never leaks the raw provider error message to the translated message", () => {
    const secret = "super-secret-internal-detail-xyz"
    const result = classifyWhatsAppError(400, { code: 999, message: secret })
    expect(result.errorMessage).not.toContain(secret)
  })

  it("falls back to a generic retryable message for an unrecognized status", () => {
    const result = classifyWhatsAppError(200, undefined)
    expect(result.retryable).toBe(true)
  })
})

describe("WhatsAppCloudApiProvider.send", () => {
  const config = { accessToken: "test-token", phoneNumberId: "1234567890", templateName: "zviko_intro", templateLanguage: "en" }

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("rejects an invalid recipient without ever calling fetch", async () => {
    const provider = new WhatsAppCloudApiProvider(config)
    const result = await provider.send(draft(), { name: "Jane", phone: "not-a-number" })

    expect(result.success).toBe(false)
    if (result.success) throw new Error("expected failure")
    expect(result.errorCode).toBe("INVALID_RECIPIENT")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("posts a template message to the correct Graph API URL with the approved body as the template parameter", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ messages: [{ id: "wamid.HBgLMTIz" }] }),
    } as Response)

    const provider = new WhatsAppCloudApiProvider(config)
    const result = await provider.send(draft(), { name: "Jane", phone: "0771234567" })

    expect(result).toEqual({ success: true, providerMessageId: "wamid.HBgLMTIz", providerName: "whatsapp_cloud_api" })
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe(`https://graph.facebook.com/${DEFAULT_WHATSAPP_API_VERSION}/1234567890/messages`)
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer test-token")
    const body = JSON.parse(init?.body as string)
    expect(body.to).toBe("263771234567")
    expect(body.type).toBe("template")
    expect(body.template.name).toBe("zviko_intro")
    expect(body.template.components[0].parameters[0].text).toBe(draft().body)
  })

  it("never sends the message unless the recipient phone normalizes cleanly - never blindly prepends a country code", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, json: async () => ({ messages: [{ id: "wamid.x" }] }) } as Response)
    const provider = new WhatsAppCloudApiProvider(config)

    await provider.send(draft(), { name: "Jane", phone: "0771234567" })
    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect(JSON.parse(init?.body as string).to).toBe("263771234567")
  })

  it("returns a retryable NETWORK_ERROR when fetch throws", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("fetch failed"))
    const provider = new WhatsAppCloudApiProvider(config)

    const result = await provider.send(draft(), { name: "Jane", phone: "0771234567" })

    expect(result.success).toBe(false)
    if (result.success) throw new Error("expected failure")
    expect(result.errorCode).toBe("NETWORK_ERROR")
    expect(result.retryable).toBe(true)
  })

  it("classifies a non-OK response using classifyWhatsAppError", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 131026, message: "..." } }),
    } as Response)
    const provider = new WhatsAppCloudApiProvider(config)

    const result = await provider.send(draft(), { name: "Jane", phone: "0771234567" })

    expect(result.success).toBe(false)
    if (result.success) throw new Error("expected failure")
    expect(result.errorCode).toBe("131026")
    expect(result.retryable).toBe(false)
  })

  it("treats a successful response with no message ID as a retryable failure, never a fabricated success", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, json: async () => ({}) } as Response)
    const provider = new WhatsAppCloudApiProvider(config)

    const result = await provider.send(draft(), { name: "Jane", phone: "0771234567" })

    expect(result.success).toBe(false)
    if (result.success) throw new Error("expected failure")
    expect(result.errorCode).toBe("NO_MESSAGE_ID")
  })
})
