import * as z from "zod"

import { Constants } from "@/lib/types/database.types"

// Structured output for WebsiteAuditService. site_accessible is the AI's
// own report of what it actually saw while researching the site - the
// service derives audit_status (COMPLETED vs UNREACHABLE) from this
// rather than guessing from Anthropic's internal tool-error shapes, which
// return as content blocks rather than exceptions.
export const AuditObservedIssueSchema = z.object({
  category: z.enum(Constants.public.Enums.audit_category),
  issue: z.string(),
  evidence: z.string(),
  source_url: z.string().optional(),
})

export const AuditInferredIssueSchema = z.object({
  category: z.enum(Constants.public.Enums.audit_category),
  issue: z.string(),
  basis: z.string(),
})

export const AuditStrengthSchema = z.object({
  category: z.enum(Constants.public.Enums.audit_category),
  strength: z.string(),
  evidence: z.string(),
})

export const AuditRecommendationSchema = z.object({
  category: z.enum(Constants.public.Enums.audit_category),
  recommendation: z.string(),
  rationale: z.string(),
})

// The 8 category scores are hard maxima of 100 each; the server - never
// the AI - combines them into overall_score using the documented weights
// in lib/services/website-audit-service.ts, so the total is always
// explainable and the weighting can change without touching this schema.
export const WebsiteAuditOutputSchema = z.object({
  site_accessible: z.boolean(),
  access_notes: z.string().optional(),
  technical_score: z.number().int().min(0).max(100),
  mobile_score: z.number().int().min(0).max(100),
  ux_score: z.number().int().min(0).max(100),
  accessibility_score: z.number().int().min(0).max(100),
  seo_score: z.number().int().min(0).max(100),
  content_score: z.number().int().min(0).max(100),
  conversion_score: z.number().int().min(0).max(100),
  functionality_score: z.number().int().min(0).max(100),
  observed_issues: z.array(AuditObservedIssueSchema),
  inferred_issues: z.array(AuditInferredIssueSchema),
  strengths: z.array(AuditStrengthSchema),
  recommendations: z.array(AuditRecommendationSchema),
  confidence: z.number().min(0).max(1),
})

export type WebsiteAuditOutput = z.infer<typeof WebsiteAuditOutputSchema>
