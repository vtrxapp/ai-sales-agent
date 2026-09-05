"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireUser } from "@/lib/dal"
import { createClient } from "@/lib/supabase/server"
import { getAIProvider, AIError } from "@/lib/ai"
import { researchBusiness } from "@/lib/services/lead-research-service"
import { scoreLead } from "@/lib/services/lead-scoring-service"
import { createBusiness, updateBusinessStatus } from "@/lib/services/business-service"
import { createContact } from "@/lib/services/contact-service"
import { createOpportunity } from "@/lib/services/opportunity-service"
import {
  contactFormSchema,
  manualBusinessSchema,
  opportunityFormSchema,
} from "@/lib/validations/business"
import { Constants, type Enums } from "@/lib/types/database.types"

export type ActionState = { error?: string; success?: string } | null
export type BulkActionState = { error?: string; summary?: string } | null

const MAX_BULK_AI_OPS = 10

function isPipelineStatus(value: string): value is Enums<"pipeline_status"> {
  return (Constants.public.Enums.pipeline_status as readonly string[]).includes(value)
}

export async function researchBusinessAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser()
  const businessId = formData.get("business_id")
  if (typeof businessId !== "string") return { error: "Missing business." }

  try {
    const ai = getAIProvider()
    const supabase = await createClient()
    await researchBusiness(supabase, ai, businessId, user.id)
  } catch (err) {
    if (err instanceof AIError) return { error: err.message }
    return { error: err instanceof Error ? err.message : "Research failed unexpectedly." }
  }

  revalidatePath(`/prospects/${businessId}`)
  return { success: "Research complete." }
}

export async function scoreBusinessAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser()
  const businessId = formData.get("business_id")
  if (typeof businessId !== "string") return { error: "Missing business." }

  try {
    const ai = getAIProvider()
    const supabase = await createClient()
    await scoreLead(supabase, ai, businessId, user.id)
  } catch (err) {
    if (err instanceof AIError) return { error: err.message }
    return { error: err instanceof Error ? err.message : "Scoring failed unexpectedly." }
  }

  revalidatePath(`/prospects/${businessId}`)
  return { success: "Scoring complete." }
}

export async function updateStatusAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser()
  const businessId = formData.get("business_id")
  const status = formData.get("status")
  if (typeof businessId !== "string" || typeof status !== "string" || !isPipelineStatus(status)) {
    return { error: "Invalid status change." }
  }

  try {
    const supabase = await createClient()
    await updateBusinessStatus(supabase, businessId, status, user.id)
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update status." }
  }

  revalidatePath(`/prospects/${businessId}`)
  revalidatePath("/pipeline")
  revalidatePath("/prospects")
  return { success: "Status updated." }
}

export async function bulkResearchAction(
  _prevState: BulkActionState,
  formData: FormData
): Promise<BulkActionState> {
  const user = await requireUser()
  const ids = formData.getAll("business_ids").map(String)
  if (ids.length === 0) return { error: "No businesses selected." }
  if (ids.length > MAX_BULK_AI_OPS) {
    return { error: `Select ${MAX_BULK_AI_OPS} or fewer businesses at a time for bulk research.` }
  }

  let ai
  try {
    ai = getAIProvider()
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI is not configured." }
  }

  const supabase = await createClient()
  let succeeded = 0
  const failures: string[] = []
  for (const id of ids) {
    try {
      await researchBusiness(supabase, ai, id, user.id)
      succeeded++
    } catch (err) {
      failures.push(err instanceof Error ? err.message : "Unknown error")
    }
  }

  revalidatePath("/prospects")
  return {
    summary: `Researched ${succeeded}/${ids.length} businesses.${
      failures.length > 0 ? ` ${failures.length} failed: ${failures[0]}` : ""
    }`,
  }
}

export async function bulkScoreAction(
  _prevState: BulkActionState,
  formData: FormData
): Promise<BulkActionState> {
  const user = await requireUser()
  const ids = formData.getAll("business_ids").map(String)
  if (ids.length === 0) return { error: "No businesses selected." }
  if (ids.length > MAX_BULK_AI_OPS) {
    return { error: `Select ${MAX_BULK_AI_OPS} or fewer businesses at a time for bulk scoring.` }
  }

  let ai
  try {
    ai = getAIProvider()
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI is not configured." }
  }

  const supabase = await createClient()
  let succeeded = 0
  const failures: string[] = []
  for (const id of ids) {
    try {
      await scoreLead(supabase, ai, id, user.id)
      succeeded++
    } catch (err) {
      failures.push(err instanceof Error ? err.message : "Unknown error")
    }
  }

  revalidatePath("/prospects")
  return {
    summary: `Scored ${succeeded}/${ids.length} businesses.${
      failures.length > 0 ? ` ${failures.length} failed: ${failures[0]}` : ""
    }`,
  }
}

export async function bulkUpdateStatusAction(
  _prevState: BulkActionState,
  formData: FormData
): Promise<BulkActionState> {
  const user = await requireUser()
  const ids = formData.getAll("business_ids").map(String)
  const status = formData.get("status")
  if (ids.length === 0) return { error: "No businesses selected." }
  if (typeof status !== "string" || !isPipelineStatus(status)) return { error: "Invalid status." }

  const supabase = await createClient()
  let succeeded = 0
  for (const id of ids) {
    try {
      await updateBusinessStatus(supabase, id, status, user.id)
      succeeded++
    } catch {
      // Best-effort bulk op - continue with the rest of the selection.
    }
  }

  revalidatePath("/prospects")
  revalidatePath("/pipeline")
  return { summary: `Updated ${succeeded}/${ids.length} businesses to ${status}.` }
}

export async function createContactAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser()
  const parsed = contactFormSchema.safeParse({
    business_id: formData.get("business_id"),
    name: formData.get("name"),
    job_title: formData.get("job_title"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    whatsapp_number: formData.get("whatsapp_number"),
    whatsapp_status: formData.get("whatsapp_status") || undefined,
    social_url: formData.get("social_url"),
    verification_status: formData.get("verification_status") || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." }

  try {
    const supabase = await createClient()
    await createContact(
      supabase,
      {
        businessId: parsed.data.business_id,
        name: parsed.data.name,
        jobTitle: parsed.data.job_title || null,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        whatsappNumber: parsed.data.whatsapp_number || null,
        whatsappStatus: parsed.data.whatsapp_status,
        socialUrl: parsed.data.social_url || null,
        source: "manual",
        verificationStatus: parsed.data.verification_status,
      },
      user.id
    )
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to add contact." }
  }

  revalidatePath(`/prospects/${parsed.data.business_id}`)
  return { success: "Contact added." }
}

export async function createOpportunityAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser()
  const parsed = opportunityFormSchema.safeParse({
    business_id: formData.get("business_id"),
    opportunity_type: formData.get("opportunity_type"),
    title: formData.get("title"),
    description: formData.get("description"),
    problem: formData.get("problem"),
    proposed_solution: formData.get("proposed_solution"),
    priority: formData.get("priority") || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." }

  try {
    const supabase = await createClient()
    await createOpportunity(
      supabase,
      {
        businessId: parsed.data.business_id,
        opportunityType: parsed.data.opportunity_type,
        title: parsed.data.title,
        description: parsed.data.description || null,
        problem: parsed.data.problem || null,
        proposedSolution: parsed.data.proposed_solution || null,
        priority: parsed.data.priority,
      },
      user.id
    )
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to add opportunity." }
  }

  revalidatePath(`/prospects/${parsed.data.business_id}`)
  return { success: "Opportunity added." }
}

export async function createManualBusinessAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser()
  const parsed = manualBusinessSchema.safeParse({
    name: formData.get("name"),
    industry: formData.get("industry"),
    description: formData.get("description"),
    location: formData.get("location"),
    city: formData.get("city"),
    country: formData.get("country"),
    website: formData.get("website"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    source_url: formData.get("source_url"),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." }

  let businessId: string
  try {
    const supabase = await createClient()
    const result = await createBusiness(
      supabase,
      {
        name: parsed.data.name,
        industry: parsed.data.industry || null,
        description: parsed.data.description || null,
        location: parsed.data.location || null,
        city: parsed.data.city || null,
        country: parsed.data.country || null,
        website: parsed.data.website || null,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        source: "manual",
        sourceUrl: parsed.data.source_url || null,
      },
      user.id
    )
    businessId = result.business.id
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to add business." }
  }

  redirect(`/prospects/${businessId}`)
}
