import { describe, expect, it, vi, beforeEach } from "vitest"

const { verifyMock, receivingGetMock } = vi.hoisted(() => ({
  verifyMock: vi.fn(),
  receivingGetMock: vi.fn(),
}))

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function MockResend() {
    return { webhooks: { verify: verifyMock }, emails: { receiving: { get: receivingGetMock } } }
  }),
}))

import { EmailInboundProvider } from "./email-inbound-provider"

function provider() {
  return new EmailInboundProvider({ apiKey: "re_test_key", webhookSecret: "whsec_test_secret" })
}

describe("EmailInboundProvider.verifySignature", () => {
  beforeEach(() => {
    verifyMock.mockReset()
  })

  it("returns true when the SDK verifies the payload without throwing, passing the extracted svix headers", () => {
    verifyMock.mockReturnValue({ type: "email.received" })
    const headers = new Headers({ "svix-id": "msg_1", "svix-timestamp": "1700000000", "svix-signature": "v1,abc" })

    expect(provider().verifySignature("{}", headers)).toBe(true)
    expect(verifyMock).toHaveBeenCalledWith({
      payload: "{}",
      headers: { id: "msg_1", timestamp: "1700000000", signature: "v1,abc" },
      webhookSecret: "whsec_test_secret",
    })
  })

  it("returns false when the SDK rejects the signature", () => {
    verifyMock.mockImplementation(() => {
      throw new Error("invalid signature")
    })
    const headers = new Headers({ "svix-id": "msg_1", "svix-timestamp": "1700000000", "svix-signature": "v1,bad" })

    expect(provider().verifySignature("{}", headers)).toBe(false)
  })

  it("returns false without calling the SDK when required svix headers are missing", () => {
    expect(provider().verifySignature("{}", new Headers())).toBe(false)
    expect(verifyMock).not.toHaveBeenCalled()
  })
})

describe("EmailInboundProvider.extractInboundMessages", () => {
  beforeEach(() => {
    receivingGetMock.mockReset()
  })

  it("fetches the full body via the Receiving API and normalizes it", async () => {
    receivingGetMock.mockResolvedValue({
      data: {
        from: "jane@abcgym.co.zw",
        to: ["hello@zvikolabs.com"],
        subject: "Re: idea",
        text: "Yes, tell me more",
        html: null,
        headers: { "In-Reply-To": "<orig@zvikolabs.com>" },
        message_id: "<reply@abcgym.co.zw>",
        created_at: "2026-01-01T00:00:00Z",
      },
      error: null,
    })
    const payload = JSON.stringify({
      type: "email.received",
      created_at: "2026-01-01T00:00:00Z",
      data: { email_id: "email_123", from: "jane@abcgym.co.zw", to: ["hello@zvikolabs.com"], subject: "Re: idea" },
    })

    const result = await provider().extractInboundMessages(payload)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      channel: "EMAIL",
      provider: "resend",
      externalMessageId: "email_123",
      senderIdentifier: "jane@abcgym.co.zw",
      recipientIdentifier: "hello@zvikolabs.com",
      messageBody: "Yes, tell me more",
      externalConversationId: "<orig@zvikolabs.com>",
    })
    expect(receivingGetMock).toHaveBeenCalledWith("email_123")
  })

  it("falls back to a stripped version of the HTML body when there's no plain text version", async () => {
    receivingGetMock.mockResolvedValue({
      data: {
        from: "jane@abcgym.co.zw",
        to: ["hello@zvikolabs.com"],
        subject: "Re: idea",
        text: null,
        html: "<p>Yes please</p>",
        headers: null,
        message_id: "<x>",
        created_at: "2026-01-01T00:00:00Z",
      },
      error: null,
    })
    const payload = JSON.stringify({
      type: "email.received",
      created_at: "2026-01-01T00:00:00Z",
      data: { email_id: "email_456", from: "jane@abcgym.co.zw", to: ["hello@zvikolabs.com"], subject: "Re: idea" },
    })

    const result = await provider().extractInboundMessages(payload)
    expect(result[0].messageBody).toBe("Yes please")
  })

  it("returns no messages for an event type other than email.received, never calling the Receiving API", async () => {
    const result = await provider().extractInboundMessages(JSON.stringify({ type: "email.sent", data: {} }))
    expect(result).toEqual([])
    expect(receivingGetMock).not.toHaveBeenCalled()
  })

  it("returns no messages when the Receiving API call fails", async () => {
    receivingGetMock.mockResolvedValue({ data: null, error: { message: "not found" } })
    const payload = JSON.stringify({
      type: "email.received",
      created_at: "2026-01-01T00:00:00Z",
      data: { email_id: "email_789", from: "x@y.com", to: ["a@b.com"], subject: "s" },
    })

    const result = await provider().extractInboundMessages(payload)
    expect(result).toEqual([])
  })

  it("returns no messages for malformed JSON, never throws", async () => {
    await expect(provider().extractInboundMessages("not json")).resolves.toEqual([])
  })
})
