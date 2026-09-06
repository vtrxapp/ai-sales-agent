import "server-only"
import crypto from "node:crypto"

import type { InboundMessageProvider, NormalizedInboundMessage } from "@/lib/inbound/types"

export type WhatsAppInboundConfig = {
  appSecret: string
  webhookVerifyToken: string
}

// GET /api/webhooks/whatsapp subscription handshake (spec section 7-8):
// Meta sends hub.mode/hub.verify_token/hub.challenge and expects the
// challenge echoed back as plain text only when mode is "subscribe" and
// the token matches what was configured in the Meta dashboard. Returns
// null (never the challenge) on any mismatch - the route must reject,
// not guess.
export function verifyWhatsAppSubscription(
  mode: string | null,
  token: string | null,
  challenge: string | null,
  config: WhatsAppInboundConfig
): string | null {
  if (mode === "subscribe" && !!token && !!challenge && token === config.webhookVerifyToken) {
    return challenge
  }
  return null
}

// HMAC-SHA256 of the raw body keyed with the Meta app's App Secret,
// compared timing-safely against X-Hub-Signature-256 (verified against
// current documentation this session - see the Phase 6 report). Must run
// against the exact raw bytes Meta signed, before any JSON.parse.
function verifyWhatsAppSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader) return false
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")
  const provided = Buffer.from(signatureHeader)
  const expectedBuf = Buffer.from(expected)
  if (provided.length !== expectedBuf.length) return false
  return crypto.timingSafeEqual(provided, expectedBuf)
}

type WhatsAppInboundMessageEvent = {
  from: string
  id: string
  timestamp: string
  type: string
  text?: { body: string }
}

type WhatsAppWebhookValue = {
  metadata?: { display_phone_number?: string; phone_number_id?: string }
  messages?: WhatsAppInboundMessageEvent[]
}

type WhatsAppWebhookPayload = {
  object?: string
  entry?: { id: string; changes?: { field?: string; value?: WhatsAppWebhookValue }[] }[]
}

// Official WhatsApp Business Platform (Meta Cloud API) webhooks only -
// same constraint as the Phase 5 sending provider (spec section 7).
export class WhatsAppInboundProvider implements InboundMessageProvider {
  readonly channel = "WHATSAPP" as const
  readonly providerName = "whatsapp_cloud_api"

  constructor(private readonly config: WhatsAppInboundConfig) {}

  verifySignature(rawBody: string, headers: Headers): boolean {
    return verifyWhatsAppSignature(rawBody, headers.get("x-hub-signature-256"), this.config.appSecret)
  }

  async extractInboundMessages(rawBody: string): Promise<NormalizedInboundMessage[]> {
    let payload: WhatsAppWebhookPayload
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return []
    }
    if (payload.object !== "whatsapp_business_account") return []

    const results: NormalizedInboundMessage[] = []
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue
        const value = change.value
        // A "messages" field also carries delivery/read status events
        // (value.statuses[]), with no value.messages[] present - not
        // processed this phase (see Phase 6 report, Known limitations).
        // Skipping is correct, not an error: the route still returns 200.
        if (!value?.messages) continue

        const recipientIdentifier = value.metadata?.phone_number_id ?? value.metadata?.display_phone_number ?? "unknown"
        for (const msg of value.messages) {
          const isText = msg.type === "text" && !!msg.text?.body
          const receivedAtMs = Number(msg.timestamp) * 1000
          results.push({
            channel: "WHATSAPP",
            provider: this.providerName,
            externalMessageId: msg.id,
            externalConversationId: null,
            senderIdentifier: msg.from,
            recipientIdentifier,
            messageBody: isText ? (msg.text as { body: string }).body : `[Unsupported WhatsApp message type: ${msg.type}]`,
            receivedAt: Number.isFinite(receivedAtMs) ? new Date(receivedAtMs).toISOString() : new Date().toISOString(),
            rawType: msg.type,
            metadata: isText ? {} : { unsupported_type: true },
          })
        }
      }
    }
    return results
  }
}
