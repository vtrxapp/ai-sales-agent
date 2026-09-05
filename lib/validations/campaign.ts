import * as z from "zod"

import { Constants } from "@/lib/types/database.types"

export const campaignFormSchema = z.object({
  product_id: z.uuid({ error: "Choose a product." }),
  name: z.string().trim().min(2, { error: "Name must be at least 2 characters." }).max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  campaign_type: z.enum(Constants.public.Enums.campaign_type, {
    error: "Choose a campaign type.",
  }),
  objective: z.string().trim().max(500).optional().or(z.literal("")),
  target_location: z.string().trim().max(200).optional().or(z.literal("")),
  target_audience: z.string().trim().max(500).optional().or(z.literal("")),
  start_date: z.string().optional().or(z.literal("")),
  end_date: z.string().optional().or(z.literal("")),
  budget: z.string().optional().or(z.literal("")),
})
.refine(
  (data) => !data.start_date || !data.end_date || data.end_date >= data.start_date,
  { error: "End date must be on or after the start date.", path: ["end_date"] }
)
.refine(
  (data) => !data.budget || (!Number.isNaN(Number(data.budget)) && Number(data.budget) >= 0),
  { error: "Budget must be a positive number.", path: ["budget"] }
)

export type CampaignFormInput = z.infer<typeof campaignFormSchema>
