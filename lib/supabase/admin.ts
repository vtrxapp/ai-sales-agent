import "server-only"

import { createClient as createSupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types/database.types"

// Service-role client. Bypasses Row Level Security - only for trusted
// server-side operations (e.g. AI services enriching records on behalf
// of any user). Never import this from a Client Component or expose the
// service-role key to the browser.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
