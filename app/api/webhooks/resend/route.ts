import { NextResponse, type NextRequest } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getEmailInboundProvider, EmailInboundNotConfiguredError } from "@/lib/inbound"
import { handleInboundWebhookDelivery } from "@/lib/services/response-processing-service"

export const runtime = "nodejs"

// A client-side request must never be trusted to say "this email came
// from Resend" - only a body whose Standard Webhooks signature verifies
// against RESEND_WEBHOOK_SECRET (via the resend SDK's own verifier) is
// processed. Uses the service-role client for the same reason as the
// WhatsApp route - see the comment there.
export async function POST(request: NextRequest) {
  let provider
  try {
    provider = getEmailInboundProvider()
  } catch (err) {
    if (err instanceof EmailInboundNotConfiguredError) {
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
    console.error("Resend webhook processing failed:", err instanceof Error ? err.message : err)
    return NextResponse.json({ error: "Processing failed." }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
