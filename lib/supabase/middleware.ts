import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Public routes that don't require an authenticated session. Everything
// else in the app is internal-only per the Growth Engine spec: no public
// signup, no anonymous access to leads/campaigns/analytics data.
//
// /api/webhooks is deliberately included: Meta and Resend call these
// endpoints directly with no Supabase session cookie at all, so gating
// them behind Supabase auth would break every inbound delivery. They are
// NOT unauthenticated in the security sense - each one verifies the
// caller's own provider-specific signature inside the route handler
// (WhatsApp's X-Hub-Signature-256, Resend's Standard Webhooks signature)
// before trusting anything in the body. See lib/inbound/.
const PUBLIC_ROUTES = ["/login", "/auth/callback", "/api/webhooks"]

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route))
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: avoid writing logic between createServerClient and
  // getUser(). A mistake here can make it very hard to debug users being
  // randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user && !isPublicRoute(pathname)) {
    const redirectUrl = new URL("/login", request.url)
    redirectUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(redirectUrl)
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/overview", request.url))
  }

  return response
}
