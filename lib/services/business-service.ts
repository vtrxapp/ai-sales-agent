import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Enums, Tables } from "@/lib/types/database.types"
import { normalizeBusinessName, normalizePhone, normalizeWebsite } from "@/lib/services/normalize"
import { findDuplicate, type DuplicateMatch } from "@/lib/services/deduplication-service"
import { logActivity } from "@/lib/services/activity-service"
import { listAuditHistory } from "@/lib/services/website-audit-service"
import { selectPrimaryOpportunity } from "@/lib/services/opportunity-selection"

export type CreateBusinessInput = {
  name: string
  industry?: string | null
  description?: string | null
  location?: string | null
  city?: string | null
  country?: string | null
  website?: string | null
  phone?: string | null
  whatsappNumber?: string | null
  whatsappStatus?: Enums<"whatsapp_status">
  email?: string | null
  source: string
  sourceUrl?: string | null
}

export type CreateBusinessResult = {
  business: Tables<"businesses">
  wasDuplicate: boolean
  duplicateReason?: DuplicateMatch["reason"]
}

function fillMissing<T extends Record<string, unknown>>(
  existing: T,
  incoming: Partial<T>
): Partial<T> {
  const patch: Partial<T> = {}
  for (const key of Object.keys(incoming) as (keyof T)[]) {
    const incomingValue = incoming[key]
    if (
      (existing[key] === null || existing[key] === undefined) &&
      incomingValue !== null &&
      incomingValue !== undefined &&
      incomingValue !== ""
    ) {
      patch[key] = incomingValue
    }
  }
  return patch
}

// Creates a business, or - if a likely duplicate already exists - fills in
// any fields the existing record is missing and logs the dedup event
// instead of creating a second row. Never merges on name similarity alone.
export async function createBusiness(
  supabase: SupabaseClient<Database>,
  input: CreateBusinessInput,
  actorId: string
): Promise<CreateBusinessResult> {
  const match = await findDuplicate(supabase, {
    name: input.name,
    website: input.website,
    phone: input.phone,
    city: input.city,
  })

  if (match) {
    const patch = fillMissing(match.business, {
      industry: input.industry ?? null,
      description: input.description ?? null,
      location: input.location ?? null,
      city: input.city ?? null,
      country: input.country ?? null,
      website: input.website ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
    })

    let business = match.business
    if (Object.keys(patch).length > 0) {
      const { data, error } = await supabase
        .from("businesses")
        .update(patch)
        .eq("id", match.business.id)
        .select()
        .single()
      if (error) throw new Error(`Failed to update existing business: ${error.message}`)
      business = data
    }

    await logActivity(supabase, {
      entityType: "business",
      entityId: business.id,
      activityType: "DUPLICATE_DETECTED",
      description: `"${input.name}" matched an existing business ("${business.name}") by ${match.reason.replace("_", " ")}; ${Object.keys(patch).length > 0 ? "filled in missing fields" : "no new information to add"}.`,
      productId: null,
      actorId,
      metadata: { source: input.source, source_url: input.sourceUrl ?? null, matched_on: match.reason },
    })

    return { business, wasDuplicate: true, duplicateReason: match.reason }
  }

  const { data: business, error } = await supabase
    .from("businesses")
    .insert({
      name: input.name,
      name_normalized: normalizeBusinessName(input.name),
      industry: input.industry ?? null,
      description: input.description ?? null,
      location: input.location ?? null,
      city: input.city ?? null,
      country: input.country ?? null,
      website: input.website ?? null,
      website_normalized: input.website ? normalizeWebsite(input.website) : null,
      phone: input.phone ?? null,
      phone_normalized: input.phone ? normalizePhone(input.phone) : null,
      whatsapp_number: input.whatsappNumber ?? null,
      whatsapp_status: input.whatsappStatus ?? "UNKNOWN",
      email: input.email ?? null,
      source: input.source,
      source_url: input.sourceUrl ?? null,
      created_by: actorId,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create business: ${error.message}`)

  await logActivity(supabase, {
    entityType: "business",
    entityId: business.id,
    activityType: "BUSINESS_DISCOVERED",
    description: `"${business.name}" was added (source: ${input.source}).`,
    productId: null,
    actorId,
    metadata: { source: input.source, source_url: input.sourceUrl ?? null },
  })

  return { business, wasDuplicate: false }
}

export type BusinessListFilters = {
  industry?: string
  location?: string
  status?: Enums<"pipeline_status">
  classification?: Enums<"lead_classification">
  minScore?: number
  hasWebsite?: boolean
  hasPhone?: boolean
  hasWhatsapp?: boolean
  hasEmail?: boolean
  hasOpportunities?: boolean
  minWebsiteScore?: number
  minOpportunityScore?: number
  opportunityType?: Enums<"opportunity_type">
  neverContacted?: boolean
  recentlyAudited?: boolean
  readyForOutreach?: boolean
  hasSalesStrategy?: boolean
  hasOutreachDraft?: boolean
  needsReview?: boolean
  hasApprovedDraft?: boolean
  primaryOpportunityPriority?: Enums<"opportunity_priority">
  minPersonalizationScore?: number
}

export type BusinessListSort =
  | "score_desc"
  | "discovered_desc"
  | "researched_desc"
  | "opportunities_desc"
  | "status"
  | "website_score_desc"
  | "opportunity_score_desc"

export type BusinessListItem = Tables<"businesses"> & {
  lead_score: Pick<Tables<"lead_scores">, "total_score" | "classification" | "confidence"> | null
  opportunity_count: number
  opportunity_types: Enums<"opportunity_type">[]
  top_opportunity_score: number | null
  primary_opportunity_priority: Enums<"opportunity_priority"> | null
  latest_audit: Pick<Tables<"website_audits">, "overall_score" | "audit_status" | "audited_at"> | null
  has_active_sales_strategy: boolean
  ready_for_outreach: boolean
  has_outreach_draft: boolean
  needs_review: boolean
  has_approved_draft: boolean
  top_personalization_score: number | null
}

type RawOpportunityProjection = Pick<
  Tables<"opportunities">,
  "score" | "opportunity_type" | "status" | "priority" | "business_impact_score" | "evidence_strength_score"
>

type RawBusinessListRow = Tables<"businesses"> & {
  lead_scores:
    | Pick<Tables<"lead_scores">, "total_score" | "classification" | "confidence">
    | Pick<Tables<"lead_scores">, "total_score" | "classification" | "confidence">[]
    | null
  opportunities: RawOpportunityProjection[] | null
  website_audits: Pick<Tables<"website_audits">, "overall_score" | "audit_status" | "audited_at">[] | null
  sales_strategies: Pick<Tables<"sales_strategies">, "status" | "recommended_channel">[] | null
  outreach_drafts: Pick<Tables<"outreach_drafts">, "status" | "personalization_score">[] | null
}

const RECENTLY_AUDITED_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

const STATUS_ORDER: Record<Enums<"pipeline_status">, number> = {
  NEW: 0,
  QUALIFIED: 1,
  CONTACTED: 2,
  REPLIED: 3,
  MEETING: 4,
  PROPOSAL: 5,
  WON: 6,
  LOST: 7,
}

export async function listBusinesses(
  supabase: SupabaseClient<Database>,
  filters: BusinessListFilters = {},
  sort: BusinessListSort = "discovered_desc"
): Promise<BusinessListItem[]> {
  const { data, error } = await supabase
    .from("businesses")
    .select(
      "*, lead_scores(total_score, classification, confidence), opportunities(score, opportunity_type, status, priority, business_impact_score, evidence_strength_score), website_audits(overall_score, audit_status, audited_at), sales_strategies(status, recommended_channel), outreach_drafts(status, personalization_score)"
    )
    .order("audited_at", { referencedTable: "website_audits", ascending: false })
    .returns<RawBusinessListRow[]>()

  if (error) throw new Error(`Failed to load businesses: ${error.message}`)

  let items: BusinessListItem[] = data.map((row) => {
    const { lead_scores, opportunities, website_audits, sales_strategies, outreach_drafts, ...business } = row
    const leadScore = Array.isArray(lead_scores) ? (lead_scores[0] ?? null) : lead_scores
    const opps = opportunities ?? []
    const opportunityScores = opps
      .map((o) => o.score)
      .filter((score): score is number => score !== null)
    const { primary } = selectPrimaryOpportunity(opps)

    const strategies = sales_strategies ?? []
    const activeStrategy = strategies.find((s) => s.status === "ACTIVE") ?? null

    const drafts = outreach_drafts ?? []
    const personalizationScores = drafts
      .map((d) => d.personalization_score)
      .filter((score): score is number => score !== null)

    return {
      ...business,
      lead_score: leadScore,
      opportunity_count: opps.length,
      opportunity_types: opps.map((o) => o.opportunity_type),
      top_opportunity_score: opportunityScores.length > 0 ? Math.max(...opportunityScores) : null,
      primary_opportunity_priority: primary?.priority ?? null,
      latest_audit: website_audits?.[0] ?? null,
      has_active_sales_strategy: activeStrategy !== null,
      ready_for_outreach: activeStrategy !== null && activeStrategy.recommended_channel !== "NONE",
      has_outreach_draft: drafts.length > 0,
      needs_review: drafts.some((d) => d.status === "NEEDS_REVIEW"),
      has_approved_draft: drafts.some((d) => d.status === "READY_TO_SEND"),
      top_personalization_score: personalizationScores.length > 0 ? Math.max(...personalizationScores) : null,
    }
  })

  if (filters.industry) {
    const needle = filters.industry.toLowerCase()
    items = items.filter((b) => b.industry?.toLowerCase().includes(needle))
  }
  if (filters.location) {
    const needle = filters.location.toLowerCase()
    items = items.filter(
      (b) =>
        b.city?.toLowerCase().includes(needle) ||
        b.country?.toLowerCase().includes(needle) ||
        b.location?.toLowerCase().includes(needle)
    )
  }
  if (filters.status) {
    items = items.filter((b) => b.pipeline_status === filters.status)
  }
  if (filters.classification) {
    items = items.filter((b) => b.lead_score?.classification === filters.classification)
  }
  if (filters.minScore !== undefined) {
    items = items.filter((b) => (b.lead_score?.total_score ?? -1) >= filters.minScore!)
  }
  if (filters.hasWebsite) {
    items = items.filter((b) => !!b.website)
  }
  if (filters.hasPhone) {
    items = items.filter((b) => !!b.phone)
  }
  if (filters.hasWhatsapp) {
    items = items.filter((b) => b.whatsapp_status === "AVAILABLE")
  }
  if (filters.hasEmail) {
    items = items.filter((b) => !!b.email)
  }
  if (filters.hasOpportunities) {
    items = items.filter((b) => b.opportunity_count > 0)
  }
  if (filters.minWebsiteScore !== undefined) {
    items = items.filter((b) => (b.latest_audit?.overall_score ?? -1) >= filters.minWebsiteScore!)
  }
  if (filters.minOpportunityScore !== undefined) {
    items = items.filter((b) => (b.top_opportunity_score ?? -1) >= filters.minOpportunityScore!)
  }
  if (filters.opportunityType) {
    items = items.filter((b) => b.opportunity_types.includes(filters.opportunityType!))
  }
  if (filters.neverContacted) {
    items = items.filter((b) => b.pipeline_status === "NEW")
  }
  if (filters.recentlyAudited) {
    items = items.filter((b) => {
      const auditedAt = b.latest_audit?.audited_at
      return !!auditedAt && Date.now() - new Date(auditedAt).getTime() <= RECENTLY_AUDITED_WINDOW_MS
    })
  }
  if (filters.readyForOutreach) {
    items = items.filter((b) => b.ready_for_outreach)
  }
  if (filters.hasSalesStrategy) {
    items = items.filter((b) => b.has_active_sales_strategy)
  }
  if (filters.hasOutreachDraft) {
    items = items.filter((b) => b.has_outreach_draft)
  }
  if (filters.needsReview) {
    items = items.filter((b) => b.needs_review)
  }
  if (filters.hasApprovedDraft) {
    items = items.filter((b) => b.has_approved_draft)
  }
  if (filters.primaryOpportunityPriority) {
    items = items.filter((b) => b.primary_opportunity_priority === filters.primaryOpportunityPriority)
  }
  if (filters.minPersonalizationScore !== undefined) {
    items = items.filter((b) => (b.top_personalization_score ?? -1) >= filters.minPersonalizationScore!)
  }

  switch (sort) {
    case "score_desc":
      items.sort((a, b) => (b.lead_score?.total_score ?? -1) - (a.lead_score?.total_score ?? -1))
      break
    case "researched_desc":
      items.sort(
        (a, b) =>
          new Date(b.last_researched_at ?? 0).getTime() -
          new Date(a.last_researched_at ?? 0).getTime()
      )
      break
    case "opportunities_desc":
      items.sort((a, b) => b.opportunity_count - a.opportunity_count)
      break
    case "website_score_desc":
      items.sort((a, b) => (b.latest_audit?.overall_score ?? -1) - (a.latest_audit?.overall_score ?? -1))
      break
    case "opportunity_score_desc":
      items.sort((a, b) => (b.top_opportunity_score ?? -1) - (a.top_opportunity_score ?? -1))
      break
    case "status":
      items.sort((a, b) => STATUS_ORDER[a.pipeline_status] - STATUS_ORDER[b.pipeline_status])
      break
    case "discovered_desc":
    default:
      items.sort(
        (a, b) => new Date(b.discovered_at).getTime() - new Date(a.discovered_at).getTime()
      )
      break
  }

  return items
}

export type BusinessDetail = Tables<"businesses"> & {
  lead_score: Tables<"lead_scores"> | null
  research_notes: Tables<"business_research_notes">[]
  opportunities: Tables<"opportunities">[]
  contacts: Tables<"contacts">[]
  audits: Tables<"website_audits">[]
}

export async function getBusinessById(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<BusinessDetail | null> {
  const { data: business, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(`Failed to load business: ${error.message}`)
  if (!business) return null

  const [leadScore, researchNotes, opportunities, contacts, audits] = await Promise.all([
    supabase.from("lead_scores").select("*").eq("business_id", id).maybeSingle(),
    supabase
      .from("business_research_notes")
      .select("*")
      .eq("business_id", id)
      .order("researched_at", { ascending: false }),
    supabase.from("opportunities").select("*").eq("business_id", id).order("created_at", { ascending: false }),
    supabase.from("contacts").select("*").eq("business_id", id).order("created_at", { ascending: false }),
    listAuditHistory(supabase, id),
  ])

  if (leadScore.error) throw new Error(`Failed to load lead score: ${leadScore.error.message}`)
  if (researchNotes.error) throw new Error(`Failed to load research notes: ${researchNotes.error.message}`)
  if (opportunities.error) throw new Error(`Failed to load opportunities: ${opportunities.error.message}`)
  if (contacts.error) throw new Error(`Failed to load contacts: ${contacts.error.message}`)

  return {
    ...business,
    lead_score: leadScore.data,
    research_notes: researchNotes.data,
    opportunities: opportunities.data,
    contacts: contacts.data,
    audits,
  }
}

export async function updateBusinessStatus(
  supabase: SupabaseClient<Database>,
  businessId: string,
  status: Enums<"pipeline_status">,
  actorId: string
): Promise<Tables<"businesses">> {
  const { data: existing, error: fetchError } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .single()
  if (fetchError) throw new Error(`Failed to load business: ${fetchError.message}`)

  if (existing.pipeline_status === status) return existing

  const { data: business, error } = await supabase
    .from("businesses")
    .update({ pipeline_status: status })
    .eq("id", businessId)
    .select()
    .single()
  if (error) throw new Error(`Failed to update status: ${error.message}`)

  await logActivity(supabase, {
    entityType: "business",
    entityId: businessId,
    activityType: "STATUS_CHANGED",
    description: `"${business.name}" moved from ${existing.pipeline_status} to ${status}.`,
    productId: null,
    actorId,
    metadata: { from: existing.pipeline_status, to: status },
  })

  return business
}

// Suppression is business-level, not per-contact (spec section 29-30) -
// the safer default, since it blocks every send to that business
// regardless of which contact a future draft targets. Enforced
// server-side inside sendOutreachMessage, never only in the UI.
export async function setDoNotContact(
  supabase: SupabaseClient<Database>,
  businessId: string,
  reason: string | null,
  actorId: string
): Promise<Tables<"businesses">> {
  const { data: business, error } = await supabase
    .from("businesses")
    .update({ do_not_contact: true, do_not_contact_reason: reason, do_not_contact_at: new Date().toISOString() })
    .eq("id", businessId)
    .select()
    .single()
  if (error) throw new Error(`Failed to mark business Do Not Contact: ${error.message}`)

  await logActivity(supabase, {
    entityType: "business",
    entityId: businessId,
    activityType: "DO_NOT_CONTACT_SET",
    description: `"${business.name}" marked Do Not Contact${reason ? `: ${reason}` : "."}`,
    productId: null,
    actorId,
    metadata: { reason },
  })

  return business
}

export async function clearDoNotContact(
  supabase: SupabaseClient<Database>,
  businessId: string,
  actorId: string
): Promise<Tables<"businesses">> {
  const { data: business, error } = await supabase
    .from("businesses")
    .update({ do_not_contact: false, do_not_contact_reason: null, do_not_contact_at: null })
    .eq("id", businessId)
    .select()
    .single()
  if (error) throw new Error(`Failed to clear Do Not Contact: ${error.message}`)

  await logActivity(supabase, {
    entityType: "business",
    entityId: businessId,
    activityType: "DO_NOT_CONTACT_CLEARED",
    description: `"${business.name}" is no longer marked Do Not Contact.`,
    productId: null,
    actorId,
    metadata: {},
  })

  return business
}
