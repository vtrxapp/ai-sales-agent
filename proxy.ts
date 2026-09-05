import { type NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/middleware"

// Renamed from `middleware.ts` per the Next.js 16 file convention. This
// performs the optimistic auth check (session cookie refresh + redirect)
// on every request; real authorization still happens server-side via
// RLS and the Supabase server client - see lib/supabase/server.ts.
export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
