"use server"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { requireUser } from "@/lib/dal"
import { campaignFormSchema } from "@/lib/validations/campaign"
import { createCampaign } from "@/lib/services/campaign-service"

export type CampaignFormState = {
  error?: string
  fieldErrors?: Record<string, string>
} | null

export async function createCampaignAction(
  _prevState: CampaignFormState,
  formData: FormData
): Promise<CampaignFormState> {
  const user = await requireUser()

  const parsed = campaignFormSchema.safeParse({
    product_id: formData.get("product_id"),
    name: formData.get("name"),
    description: formData.get("description"),
    campaign_type: formData.get("campaign_type"),
    objective: formData.get("objective"),
    target_location: formData.get("target_location"),
    target_audience: formData.get("target_audience"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
    budget: formData.get("budget"),
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form")
      if (!fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return { error: "Please fix the highlighted fields.", fieldErrors }
  }

  let campaignId: string
  try {
    const supabase = await createClient()
    const campaign = await createCampaign(supabase, parsed.data, user.id)
    campaignId = campaign.id
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create campaign." }
  }

  redirect(`/campaigns/${campaignId}`)
}
