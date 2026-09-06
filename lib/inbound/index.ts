import "server-only"

import type { InboundMessageProvider } from "@/lib/inbound/types"
import { WhatsAppInboundProvider } from "@/lib/inbound/whatsapp-inbound-provider"
import { EmailInboundProvider } from "@/lib/inbound/email-inbound-provider"
import { WhatsAppInboundNotConfiguredError, EmailInboundNotConfiguredError } from "@/lib/inbound/errors"

export type { InboundMessageProvider, NormalizedInboundMessage } from "@/lib/inbound/types"
export * from "@/lib/inbound/errors"
export { verifyWhatsAppSubscription } from "@/lib/inbound/whatsapp-inbound-provider"

export type WhatsAppInboundConfigStatus =
  | { configured: true }
  | { configured: false; missingEnvVars: string[] }

export function getWhatsAppInboundConfigStatus(): WhatsAppInboundConfigStatus {
  const missingEnvVars: string[] = []
  if (!process.env.WHATSAPP_APP_SECRET) missingEnvVars.push("WHATSAPP_APP_SECRET")
  if (!process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) missingEnvVars.push("WHATSAPP_WEBHOOK_VERIFY_TOKEN")
  if (missingEnvVars.length > 0) return { configured: false, missingEnvVars }
  return { configured: true }
}

export type EmailInboundConfigStatus =
  | { configured: true }
  | { configured: false; missingEnvVars: string[] }

export function getEmailInboundConfigStatus(): EmailInboundConfigStatus {
  const missingEnvVars: string[] = []
  if (!process.env.RESEND_API_KEY) missingEnvVars.push("RESEND_API_KEY")
  if (!process.env.RESEND_WEBHOOK_SECRET) missingEnvVars.push("RESEND_WEBHOOK_SECRET")
  if (missingEnvVars.length > 0) return { configured: false, missingEnvVars }
  return { configured: true }
}

export function getWhatsAppInboundProvider(): InboundMessageProvider {
  const status = getWhatsAppInboundConfigStatus()
  if (!status.configured) throw new WhatsAppInboundNotConfiguredError()
  return new WhatsAppInboundProvider({
    appSecret: process.env.WHATSAPP_APP_SECRET as string,
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN as string,
  })
}

export function getEmailInboundProvider(): InboundMessageProvider {
  const status = getEmailInboundConfigStatus()
  if (!status.configured) throw new EmailInboundNotConfiguredError()
  return new EmailInboundProvider({
    apiKey: process.env.RESEND_API_KEY as string,
    webhookSecret: process.env.RESEND_WEBHOOK_SECRET as string,
  })
}
