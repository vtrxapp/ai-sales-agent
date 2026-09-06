export class InboundProviderError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = "InboundProviderError"
  }
}

export class WhatsAppInboundNotConfiguredError extends InboundProviderError {
  readonly code = "WHATSAPP_INBOUND_NOT_CONFIGURED"
  constructor(
    message = "WhatsApp inbound tracking is not configured. Set WHATSAPP_APP_SECRET and WHATSAPP_WEBHOOK_VERIFY_TOKEN."
  ) {
    super(message)
    this.name = "WhatsAppInboundNotConfiguredError"
  }
}

export class EmailInboundNotConfiguredError extends InboundProviderError {
  readonly code = "EMAIL_INBOUND_NOT_CONFIGURED"
  constructor(message = "Email inbound tracking is not configured. Set RESEND_API_KEY and RESEND_WEBHOOK_SECRET.") {
    super(message)
    this.name = "EmailInboundNotConfiguredError"
  }
}
