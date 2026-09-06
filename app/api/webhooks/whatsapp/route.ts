import { NextResponse, type NextRequest } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  getWhatsAppInboundProvider,
  verifyWhatsAppSubscription,
  WhatsAppInboundNotConfiguredError,
} from "@/lib/inbound"
import { handleInboundWebhookDelivery } from "@/lib/services/response-processing-service"

// Signature verification needs Node's crypto module.
export const runtime = "nodejs"

// Meta's one-time subscription handshake (spec section 7-8): confirms
// hub.mode=subscribe and hub.verify_token match, then echoes hub.challenge
// back as plain text. Any mismatch is rejected outright - never guessed.
export async function GET(request: NextRequest) {
  if (!process.env.WHATSAPP_APP_SECRET || !process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse("WhatsApp inbound webhook is not configured.", { status: 503 })
  }

  const mode = request.nextUrl.searchParams.get("hub.mode")
  const token = request.nextUrl.searchParams.get("hub.verify_token")
  const challenge = request.nextUrl.searchParams.get("hub.challenge")

  const confirmed = verifyWhatsAppSubscription(mode, token, challenge, {
    appSecret: process.env.WHATSAPP_APP_SECRET,
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
  })
  if (confirmed === null) {
    return new NextResponse("Verification failed.", { status: 403 })
  }
  return new NextResponse(confirmed, { status: 200 })
}

// A client-side request must never be trusted to say "this message came
// from WhatsApp" - only a body whose X-Hub-Signature-256 verifies against
// WHATSAPP_APP_SECRET is processed. Uses the service-role client
// (lib/supabase/admin.ts) because this request carries no Supabase user
// session at all - Meta calls this endpoint directly - so the normal
// per-request client would have no authenticated role for RLS to allow
// through; the signature check above is what stands in for
// authentication here instead.
export async function POST(request: NextRequest) {
  let provider
  try {
    provider = getWhatsAppInboundProvider()
  } catch (err) {
    if (err instanceof WhatsAppInboundNotConfiguredError) {
      return NextResponse.json({ error: err.code }, { status: 503 })
    }
    throw err
  }

  const rawBody = await request.text()

  if (!provider.verifySignature(rawBody, request.headers)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 })
  }

  const supabase = createAdminClient()
  try {
    await handleInboundWebhookDelivery(supabase, provider, rawBody)
  } catch (err) {
    console.error("WhatsApp webhook processing failed:", err instanceof Error ? err.message : err)
    return NextResponse.json({ error: "Processing failed." }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
