import type { Json } from "@/lib/types/database.types"

// A provider-neutral inbound message, already normalized out of
// WhatsApp's or Resend's own payload shape - the rest of the app (the
// matching/classification pipeline) never touches a raw provider
// payload directly (spec section 36).
export type NormalizedInboundMessage = {
  channel: "WHATSAPP" | "EMAIL"
  provider: string
  externalMessageId: string
  externalConversationId: string | null
  /** Raw sender address/number exactly as the provider reported it - never normalized here. */
  senderIdentifier: string
  /** Our own WhatsApp number / email address that received it. */
  recipientIdentifier: string
  messageBody: string
  /** ISO 8601. */
  receivedAt: string
  rawType: string | null
  metadata: Record<string, Json>
}

// verifySignature/extractInboundMessages are the only two operations the
// webhook route needs from a provider - everything else (the GET
// subscription-verification handshake WhatsApp specifically requires)
// is channel-specific enough that forcing it into this shared interface
// would need an unused method on the other implementation, so it stays
// as its own exported function in whatsapp-inbound-provider.ts instead.
export interface InboundMessageProvider {
  readonly channel: "WHATSAPP" | "EMAIL"
  readonly providerName: string
  /** Authenticates a POST delivery using the provider's own signature scheme. Never trust a payload this rejects. */
  verifySignature(rawBody: string, headers: Headers): boolean
  /**
   * Returns zero or more normalized messages found in this delivery -
   * empty for a well-formed but not-yet-supported event (a delivery/read
   * status event, an unrecognized object type). Never throws for a
   * malformed-but-parseable payload; a webhook retry must always get a
   * clean 200/4xx response, not an unhandled exception.
   */
  extractInboundMessages(rawBody: string): Promise<NormalizedInboundMessage[]>
}
