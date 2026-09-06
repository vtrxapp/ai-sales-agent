// Typed configuration errors so callers (server actions, UI, the
// provider status page) can distinguish "not configured" from a genuine
// bug, and never have to guess from a string message. `code` carries the
// exact sentinel spec section 34 asks for.

export class OutreachProviderError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = "OutreachProviderError"
  }
}

export class WhatsAppNotConfiguredError extends OutreachProviderError {
  readonly code = "WHATSAPP_PROVIDER_NOT_CONFIGURED"
  constructor(
    message = "WhatsApp sending is not configured. Set WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE_NAME, and WHATSAPP_TEMPLATE_LANGUAGE."
  ) {
    super(message)
    this.name = "WhatsAppNotConfiguredError"
  }
}

export class EmailNotConfiguredError extends OutreachProviderError {
  readonly code = "EMAIL_PROVIDER_NOT_CONFIGURED"
  constructor(message = "Email sending is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.") {
    super(message)
    this.name = "EmailNotConfiguredError"
  }
}
