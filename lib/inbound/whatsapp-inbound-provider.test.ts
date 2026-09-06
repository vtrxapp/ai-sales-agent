import { describe, expect, it } from "vitest"
import crypto from "node:crypto"

import { WhatsAppInboundProvider, verifyWhatsAppSubscription } from "./whatsapp-inbound-provider"

const config = { appSecret: "test-app-secret", webhookVerifyToken: "test-verify-token" }

function sign(body: string, secret: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex")
}

describe("verifyWhatsAppSubscription", () => {
  it("echoes the challenge when mode and token both match", () => {
    expect(verifyWhatsAppSubscription("subscribe", "test-verify-token", "12345", config)).toBe("12345")
  })

  it("rejects a wrong verify token", () => {
    expect(verifyWhatsAppSubscription("subscribe", "wrong-token", "12345", config)).toBeNull()
  })

  it("rejects a mode other than subscribe", () => {
    expect(verifyWhatsAppSubscription("unsubscribe", "test-verify-token", "12345", config)).toBeNull()
  })

  it("rejects missing parameters", () => {
    expect(verifyWhatsAppSubscription(null, null, null, config)).toBeNull()
    expect(verifyWhatsAppSubscription("subscribe", "test-verify-token", null, config)).toBeNull()
  })
})

describe("WhatsAppInboundProvider.verifySignature", () => {
  const provider = new WhatsAppInboundProvider(config)

  it("accepts a correctly signed body", () => {
    const body = '{"object":"whatsapp_business_account"}'
    const headers = new Headers({ "x-hub-signature-256": sign(body, config.appSecret) })
    expect(provider.verifySignature(body, headers)).toBe(true)
  })

  it("rejects a body signed with the wrong secret", () => {
    const body = '{"object":"whatsapp_business_account"}'
    const headers = new Headers({ "x-hub-signature-256": sign(body, "wrong-secret") })
    expect(provider.verifySignature(body, headers)).toBe(false)
  })

  it("rejects a tampered body that doesn't match its signature", () => {
    const originalBody = '{"object":"whatsapp_business_account","entry":[]}'
    const tamperedBody = '{"object":"whatsapp_business_account","entry":[{"evil":true}]}'
    const headers = new Headers({ "x-hub-signature-256": sign(originalBody, config.appSecret) })
    expect(provider.verifySignature(tamperedBody, headers)).toBe(false)
  })

  it("rejects a missing signature header", () => {
    expect(provider.verifySignature("{}", new Headers())).toBe(false)
  })
})

describe("WhatsAppInboundProvider.extractInboundMessages", () => {
  const provider = new WhatsAppInboundProvider(config)

  it("extracts a plain text message", async () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba-1",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "1234567890" },
                messages: [{ from: "263771234567", id: "wamid.ABC", timestamp: "1700000000", type: "text", text: { body: "Hi, tell me more" } }],
              },
            },
          ],
        },
      ],
    }
    const result = await provider.extractInboundMessages(JSON.stringify(payload))
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      channel: "WHATSAPP",
      provider: "whatsapp_cloud_api",
      externalMessageId: "wamid.ABC",
      senderIdentifier: "263771234567",
      recipientIdentifier: "1234567890",
      messageBody: "Hi, tell me more",
      rawType: "text",
    })
  })

  it("still stores a non-text message with a clear placeholder body rather than dropping it silently", async () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba-1",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "1234567890" },
                messages: [{ from: "263771234567", id: "wamid.IMG", timestamp: "1700000000", type: "image" }],
              },
            },
          ],
        },
      ],
    }
    const result = await provider.extractInboundMessages(JSON.stringify(payload))
    expect(result).toHaveLength(1)
    expect(result[0].messageBody).toContain("image")
    expect(result[0].metadata.unsupported_type).toBe(true)
  })

  it("returns no messages for a delivery/read status-only event", async () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba-1",
          changes: [{ field: "messages", value: { metadata: { phone_number_id: "1234567890" }, statuses: [{ id: "wamid.ABC", status: "delivered" }] } }],
        },
      ],
    }
    const result = await provider.extractInboundMessages(JSON.stringify(payload))
    expect(result).toEqual([])
  })

  it("returns no messages for a payload of the wrong object type", async () => {
    const result = await provider.extractInboundMessages(JSON.stringify({ object: "page" }))
    expect(result).toEqual([])
  })

  it("returns no messages for malformed JSON, never throws", async () => {
    await expect(provider.extractInboundMessages("not json")).resolves.toEqual([])
  })
})
