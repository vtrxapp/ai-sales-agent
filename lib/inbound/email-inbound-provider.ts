import "server-only"
import { Resend } from "resend"

import type { InboundMessageProvider, NormalizedInboundMessage } from "@/lib/inbound/types"

export type EmailInboundConfig = {
  apiKey: string
  webhookSecret: string
}

function findHeader(headers: Record<string, string> | null | undefined, name: string): string | null {
  if (!headers) return null
  const lower = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) return value
  }
  return null
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

type EmailReceivedWebhookEvent = {
  type: "email.received"
  created_at: string
  data: { email_id: string; from: string; to: string[]; subject: string }
}

// Resend genuinely supports inbound email (verified against the
// installed `resend` SDK's own type declarations this session, since
// resend.com itself is unreachable from this sandbox - see the Phase 6
// report). A webhook delivers metadata only; the full body is fetched
// separately via the Receiving API using the same RESEND_API_KEY
// already configured for sending.
export class EmailInboundProvider implements InboundMessageProvider {
  readonly channel = "EMAIL" as const
  readonly providerName = "resend"
  private readonly client: Resend

  constructor(private readonly config: EmailInboundConfig) {
    this.client = new Resend(config.apiKey)
  }

  // Resend uses the Standard Webhooks signing scheme (the same
  // HMAC-SHA256-over-id.timestamp.body construction the industry calls
  // "Svix-style", since Svix authored the open spec): the SDK's own
  // webhooks.verify() implements this rather than a hand-rolled version
  // here, since the exact algorithm couldn't be independently confirmed
  // against resend.com's own docs (blocked from this sandbox) - using
  // the vendor's own verifier removes that uncertainty entirely. Its
  // `headers` option is the SDK's own {id, timestamp, signature} shape
  // (confirmed from the installed SDK's own type declarations), not a
  // Fetch API Headers instance - the three svix-* values are extracted
  // here.
  verifySignature(rawBody: string, headers: Headers): boolean {
    const svixId = headers.get("svix-id")
    const svixTimestamp = headers.get("svix-timestamp")
    const svixSignature = headers.get("svix-signature")
    if (!svixId || !svixTimestamp || !svixSignature) return false

    try {
      this.client.webhooks.verify({
        payload: rawBody,
        headers: { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
        webhookSecret: this.config.webhookSecret,
      })
      return true
    } catch {
      return false
    }
  }

  async extractInboundMessages(rawBody: string): Promise<NormalizedInboundMessage[]> {
    let event: unknown
    try {
      event = JSON.parse(rawBody)
    } catch {
      return []
    }
    if (
      typeof event !== "object" ||
      event === null ||
      (event as { type?: unknown }).type !== "email.received"
    ) {
      return []
    }
    const receivedEvent = event as EmailReceivedWebhookEvent
    const emailId = receivedEvent.data?.email_id
    if (!emailId) return []

    const { data: email, error } = await this.client.emails.receiving.get(emailId)
    if (error || !email) return []

    const inReplyTo = findHeader(email.headers, "In-Reply-To") ?? findHeader(email.headers, "References")

    return [
      {
        channel: "EMAIL",
        provider: this.providerName,
        externalMessageId: emailId,
        externalConversationId: inReplyTo,
        senderIdentifier: email.from,
        recipientIdentifier: email.to?.[0] ?? receivedEvent.data.to?.[0] ?? "unknown",
        messageBody: email.text || stripHtml(email.html ?? "") || "(no readable content)",
        receivedAt: email.created_at || receivedEvent.created_at || new Date().toISOString(),
        rawType: "email",
        metadata: { subject: email.subject ?? null, message_id: email.message_id ?? null },
      },
    ]
  }
}
