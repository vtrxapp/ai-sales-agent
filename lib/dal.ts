import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import type { Tables } from "@/lib/types/database.types"

// Data Access Layer: the one place Server Components/Actions/Route
// Handlers go to find out who's signed in. proxy.ts already redirects
// unauthenticated requests away from protected routes (optimistic check);
// this is the real, per-request check close to the data.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

export const requireUser = cache(async () => {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  return user
})

export const getCurrentProfile = cache(async (): Promise<Tables<"profiles"> | null> => {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  return data
})
