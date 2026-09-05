import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Tables } from "@/lib/types/database.types"
import { normalizeBusinessName, normalizePhone, normalizeWebsite } from "@/lib/services/normalize"

export type DuplicateCandidate = {
  name: string
  website?: string | null
  phone?: string | null
  city?: string | null
}

export type DuplicateMatch = {
  business: Tables<"businesses">
  reason: "website" | "phone" | "name_and_city"
}

// Finds a likely-duplicate business, or null if the candidate looks new.
// Matching rule (spec: "do not merge businesses merely because their names
// are similar"): an exact website or phone match is sufficient on its own
// (strong signal); a name match alone is never sufficient - it also
// requires a matching city.
export async function findDuplicate(
  supabase: SupabaseClient<Database>,
  candidate: DuplicateCandidate
): Promise<DuplicateMatch | null> {
  const websiteNormalized = candidate.website ? normalizeWebsite(candidate.website) : null
  const phoneNormalized = candidate.phone ? normalizePhone(candidate.phone) : null
  const nameNormalized = normalizeBusinessName(candidate.name)

  if (websiteNormalized) {
    const { data } = await supabase
      .from("businesses")
      .select("*")
      .eq("website_normalized", websiteNormalized)
      .maybeSingle()
    if (data) return { business: data, reason: "website" }
  }

  if (phoneNormalized) {
    const { data } = await supabase
      .from("businesses")
      .select("*")
      .eq("phone_normalized", phoneNormalized)
      .maybeSingle()
    if (data) return { business: data, reason: "phone" }
  }

  if (candidate.city) {
    const { data } = await supabase
      .from("businesses")
      .select("*")
      .eq("name_normalized", nameNormalized)
      .eq("city", candidate.city)
      .maybeSingle()
    if (data) return { business: data, reason: "name_and_city" }
  }

  return null
}
