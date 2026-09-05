import * as z from "zod"

import { Constants } from "@/lib/types/database.types"

export const discoveryCriteriaSchema = z.object({
  industry: z.string().trim().max(200).optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  business_type: z.string().trim().max(200).optional().or(z.literal("")),
  search_query: z.string().trim().max(1000).optional().or(z.literal("")),
  count: z.coerce.number().int().min(1).max(20),
  website_required: z.coerce.boolean().optional(),
  contact_required: z.coerce.boolean().optional(),
})
.refine(
  (data) => data.industry || data.location || data.business_type || data.search_query,
  { error: "Provide at least one of industry, location, business type, or a search query." }
)

export type DiscoveryCriteriaInput = z.infer<typeof discoveryCriteriaSchema>

export const manualBusinessSchema = z.object({
  name: z.string().trim().min(2, { error: "Name must be at least 2 characters." }).max(300),
  industry: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  location: z.string().trim().max(300).optional().or(z.literal("")),
  city: z.string().trim().max(200).optional().or(z.literal("")),
  country: z.string().trim().max(200).optional().or(z.literal("")),
  website: z.url({ error: "Enter a valid URL." }).optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  email: z.email({ error: "Enter a valid email." }).optional().or(z.literal("")),
  source_url: z.url({ error: "Enter a valid URL." }).optional().or(z.literal("")),
})

export type ManualBusinessInput = z.infer<typeof manualBusinessSchema>

export const contactFormSchema = z.object({
  business_id: z.uuid(),
  name: z.string().trim().min(2, { error: "Name must be at least 2 characters." }).max(200),
  job_title: z.string().trim().max(200).optional().or(z.literal("")),
  email: z.email({ error: "Enter a valid email." }).optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  whatsapp_number: z.string().trim().max(50).optional().or(z.literal("")),
  whatsapp_status: z.enum(Constants.public.Enums.whatsapp_status).optional(),
  social_url: z.url({ error: "Enter a valid URL." }).optional().or(z.literal("")),
  verification_status: z.enum(Constants.public.Enums.contact_verification_status).optional(),
})

export type ContactFormInput = z.infer<typeof contactFormSchema>

export const opportunityFormSchema = z.object({
  business_id: z.uuid(),
  opportunity_type: z.enum(Constants.public.Enums.opportunity_type),
  title: z.string().trim().min(2, { error: "Title must be at least 2 characters." }).max(300),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  problem: z.string().trim().max(2000).optional().or(z.literal("")),
  proposed_solution: z.string().trim().max(2000).optional().or(z.literal("")),
  priority: z.enum(Constants.public.Enums.opportunity_priority).optional(),
})

export type OpportunityFormInput = z.infer<typeof opportunityFormSchema>
