import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

import { ResendEmailProvider, classifyResendError } from "./email-provider"
import type { Tables } from "@/lib/types/database.types"

function draft(overrides: Partial<Tables<"outreach_drafts">> = {}): Tables<"outreach_drafts"> {
  return {
    id: "draft-1",
    business_id: "biz-1",
    contact_id: "contact-1",
    opportunity_id: "opp-1",
    sales_strategy_id: "strategy-1",
    conversation_id: null,
    response_to_message_id: null,
    rationale: null,
    channel: "EMAIL",
    message_type: "INITIAL_OUTREACH",
    variant: "DIRECT",
    subject: "Quick idea for ABC Gym",
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

describe("classifyResendError", () => {
  it("treats 429 as retryable", () => {
    expect(classifyResendError(429, null).retryable).toBe(true)
  })

  it("treats 5xx as retryable", () => {
    expect(classifyResendError(500, null).retryable).toBe(true)
  })

  it("treats 401/403 as a non-retryable configuration problem", () => {
    expect(classifyResendError(401, null).retryable).toBe(false)
    expect(classifyResendError(403, null).errorMessage).toMatch(/RESEND_API_KEY/)
  })

  it("never leaks the raw provider error message", () => {
    const secret = "internal-detail-should-not-leak"
    const result = classifyResendError(422, { name: "validation_error", message: secret })
    expect(result.errorMessage).not.toContain(secret)
  })
})

describe("ResendEmailProvider.send", () => {
  const config = { apiKey: "re_test_key", fromEmail: "hello@zvikolabs.com", fromName: "Zviko Labs" }

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("rejects a recipient with no email without calling fetch", async () => {
    const provider = new ResendEmailProvider(config)
    const result = await provider.send(draft(), { name: "Jane" })

    expect(result.success).toBe(false)
    if (result.success) throw new Error("expected failure")
    expect(result.errorCode).toBe("INVALID_RECIPIENT")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("rejects a draft with no subject without calling fetch", async () => {
    const provider = new ResendEmailProvider(config)
    const result = await provider.send(draft({ subject: null }), { name: "Jane", email: "jane@abcgym.co.zw" })

    expect(result.success).toBe(false)
    if (result.success) throw new Error("expected failure")
    expect(result.errorCode).toBe("MISSING_SUBJECT")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("posts to the Resend API with the approved subject/body and returns the message id", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "re_abc123" }) } as Response)
    const provider = new ResendEmailProvider(config)

    const result = await provider.send(draft(), { name: "Jane", email: "jane@abcgym.co.zw" })

    expect(result).toEqual({ success: true, providerMessageId: "re_abc123", providerName: "resend" })
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe("https://api.resend.com/emails")
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer re_test_key")
    const body = JSON.parse(init?.body as string)
    expect(body.from).toBe("Zviko Labs <hello@zvikolabs.com>")
    expect(body.to).toBe("jane@abcgym.co.zw")
    expect(body.subject).toBe(draft().subject)
    expect(body.text).toBe(draft().body)
  })

  it("returns a retryable NETWORK_ERROR when fetch throws", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("fetch failed"))
    const provider = new ResendEmailProvider(config)

    const result = await provider.send(draft(), { name: "Jane", email: "jane@abcgym.co.zw" })

    expect(result.success).toBe(false)
    if (result.success) throw new Error("expected failure")
    expect(result.errorCode).toBe("NETWORK_ERROR")
    expect(result.retryable).toBe(true)
  })

  it("treats a successful response with no id as a retryable failure, never a fabricated success", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, json: async () => ({}) } as Response)
    const provider = new ResendEmailProvider(config)

    const result = await provider.send(draft(), { name: "Jane", email: "jane@abcgym.co.zw" })

    expect(result.success).toBe(false)
    if (result.success) throw new Error("expected failure")
    expect(result.errorCode).toBe("NO_MESSAGE_ID")
  })
})
