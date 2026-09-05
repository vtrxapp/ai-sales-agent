import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"

// Handles the Supabase magic-link redirect: exchanges the emailed code
// for a session cookie, then sends the user on to where they meant to go.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/overview"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=Could not verify sign-in link`
  )
}
