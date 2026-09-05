"use server"

import { redirect } from "next/navigation"

import { requireUser } from "@/lib/dal"
import { createClient } from "@/lib/supabase/server"
import { getAIProvider, AIError, AINotConfiguredError } from "@/lib/ai"
import { AIWebResearchDiscoveryProvider } from "@/lib/services/discovery/ai-web-research-provider"
import { discoverBusinesses } from "@/lib/services/business-discovery-service"
import { createBusiness } from "@/lib/services/business-service"
import { discoveryCriteriaSchema } from "@/lib/validations/business"
import { DiscoveryOutputSchema, type DiscoveredBusinessCandidate } from "@/lib/validations/ai-discovery"

export type DiscoverLeadsState = {
  error?: string
  candidates?: DiscoveredBusinessCandidate[]
} | null

export async function discoverLeadsAction(
  _prevState: DiscoverLeadsState,
  formData: FormData
): Promise<DiscoverLeadsState> {
  await requireUser()

  const parsed = discoveryCriteriaSchema.safeParse({
    industry: formData.get("industry"),
    location: formData.get("location"),
    business_type: formData.get("business_type"),
    search_query: formData.get("search_query"),
    count: formData.get("count"),
    website_required: formData.get("website_required") === "on",
    contact_required: formData.get("contact_required") === "on",
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  let ai
  try {
    ai = getAIProvider()
  } catch (err) {
    if (err instanceof AINotConfiguredError) return { error: err.message }
    throw err
  }

  try {
    const candidates = await discoverBusinesses(new AIWebResearchDiscoveryProvider(ai), {
      industry: parsed.data.industry || undefined,
      location: parsed.data.location || undefined,
      businessType: parsed.data.business_type || undefined,
      searchQuery: parsed.data.search_query || undefined,
      count: parsed.data.count,
      websiteRequired: parsed.data.website_required,
      contactRequired: parsed.data.contact_required,
    })

    if (candidates.length === 0) {
      return {
        error:
          "No businesses were found matching that criteria (or none survived the website/contact filters). Try broadening the search.",
      }
    }

    return { candidates }
  } catch (err) {
    if (err instanceof AIError) return { error: err.message }
    return { error: err instanceof Error ? err.message : "Discovery failed unexpectedly." }
  }
}

export type SaveLeadsState = { error?: string } | null

export async function saveLeadsAction(
  _prevState: SaveLeadsState,
  formData: FormData
): Promise<SaveLeadsState> {
  const user = await requireUser()

  const candidatesJson = formData.get("candidates_json")
  if (typeof candidatesJson !== "string") {
    return { error: "Missing discovery results. Please run discovery again." }
  }

  let candidates: DiscoveredBusinessCandidate[]
  try {
    candidates = DiscoveryOutputSchema.shape.candidates.parse(JSON.parse(candidatesJson))
  } catch {
    return { error: "Discovery results were corrupted. Please run discovery again." }
  }

  const selectedIndices = formData.getAll("selected").map((value) => Number(value))
  if (selectedIndices.length === 0) {
    return { error: "Select at least one business to save." }
  }

  const supabase = await createClient()
  let savedCount = 0
  let duplicateCount = 0

  for (const index of selectedIndices) {
    const candidate = candidates[index]
    if (!candidate) continue

    const result = await createBusiness(
      supabase,
      {
        name: candidate.name,
        industry: candidate.industry ?? null,
        description: candidate.description ?? null,
        location: candidate.location ?? null,
        city: candidate.city ?? null,
        country: candidate.country ?? null,
        website: candidate.website ?? null,
        phone: candidate.phone ?? null,
        email: candidate.email ?? null,
        source: "ai_web_search",
        sourceUrl: candidate.source_url ?? null,
      },
      user.id
    )
    savedCount++
    if (result.wasDuplicate) duplicateCount++
  }

  redirect(`/prospects?saved=${savedCount}&duplicates=${duplicateCount}`)
}
