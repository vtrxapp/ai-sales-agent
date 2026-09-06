import Link from "next/link"
import { notFound } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getBusinessById } from "@/lib/services/business-service"
import { listRecentActivities } from "@/lib/services/activity-service"
import { getNextAction, type NextAction } from "@/lib/services/next-action-service"
import { listSalesStrategies } from "@/lib/services/sales-strategy-service"
import { listOutreachDrafts } from "@/lib/services/outreach-draft-service"
import type { Enums } from "@/lib/types/database.types"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ActivityFeed } from "@/components/dashboard/activity-feed"
import { ResearchScoreActions } from "@/components/prospects/research-score-actions"
import { StatusControl } from "@/components/prospects/status-control"
import { OpportunityStatusControl } from "@/components/prospects/opportunity-status-control"
import { AddContactForm } from "@/components/prospects/add-contact-form"
import { AddOpportunityForm } from "@/components/prospects/add-opportunity-form"
import { GenerateOutreachAction } from "@/components/prospects/generate-outreach-action"
import { OutreachDraftCard } from "@/components/prospects/outreach-draft-card"

// Website audits chain up to 3 sequential AI calls (research + audit
// extraction + opportunity analysis), and Generate Outreach chains up to
// 2 more (sales strategy + message variants) - a slow site or a long
// research history can approach this budget. Raise this if the Vercel
// plan in use supports a higher function duration; left at 60 here since
// that isn't known.
export const maxDuration = 60

type Observation = { fact: string; source_url?: string }
type Inference = { inference: string; basis: string }
type Recommendation = { recommendation: string; rationale: string }
type DigitalPresence = {
  has_website?: boolean
  has_online_booking?: boolean
  has_ecommerce?: boolean
  has_customer_portal?: boolean
  has_mobile_app?: boolean
  has_online_forms?: boolean
  social_platforms?: string[]
  notes?: string
}

type AuditObservedIssue = { category: string; issue: string; evidence: string; source_url?: string }
type AuditInferredIssue = { category: string; issue: string; basis: string }
type AuditStrength = { category: string; strength: string; evidence: string }
type AuditRecommendation = { category: string; recommendation: string; rationale: string }

const SCORE_COMPONENTS = [
  { key: "industry_fit_score", max: 20, label: "Industry fit", reasoningKey: "industry_fit" },
  { key: "digital_problems_score", max: 20, label: "Digital problems", reasoningKey: "digital_problems" },
  { key: "missing_functionality_score", max: 20, label: "Missing functionality", reasoningKey: "missing_functionality" },
  { key: "business_potential_score", max: 15, label: "Business potential", reasoningKey: "business_potential" },
  { key: "contactability_score", max: 10, label: "Contactability", reasoningKey: "contactability" },
  { key: "growth_potential_score", max: 10, label: "Growth potential", reasoningKey: "growth_potential" },
  { key: "other_score", max: 5, label: "Other", reasoningKey: "other" },
] as const

const OPPORTUNITY_SCORE_COMPONENTS = [
  { key: "business_impact_score", max: 25, label: "Business impact", reasoningKey: "business_impact" },
  { key: "evidence_strength_score", max: 20, label: "Evidence strength", reasoningKey: "evidence_strength" },
  { key: "customer_need_score", max: 15, label: "Customer need", reasoningKey: "customer_need" },
  { key: "commercial_fit_score", max: 15, label: "Commercial fit", reasoningKey: "commercial_fit" },
  { key: "urgency_score", max: 10, label: "Urgency", reasoningKey: "urgency" },
  { key: "feasibility_score", max: 15, label: "Feasibility", reasoningKey: "feasibility" },
] as const

const AUDIT_CATEGORY_COMPONENTS = [
  { key: "technical_score", label: "Technical" },
  { key: "mobile_score", label: "Mobile" },
  { key: "ux_score", label: "UX" },
  { key: "accessibility_score", label: "Accessibility" },
  { key: "seo_score", label: "SEO" },
  { key: "content_score", label: "Content" },
  { key: "conversion_score", label: "Conversion" },
  { key: "functionality_score", label: "Functionality" },
] as const

const DIGITAL_PRESENCE_LABELS: Record<keyof Omit<DigitalPresence, "social_platforms" | "notes">, string> = {
  has_website: "Website",
  has_online_booking: "Online booking",
  has_ecommerce: "E-commerce",
  has_customer_portal: "Customer portal",
  has_mobile_app: "Mobile app",
  has_online_forms: "Online forms",
}

const NEXT_ACTION_LABELS: Record<NextAction, string> = {
  RESEARCH_BUSINESS: "Run Research",
  AUDIT_WEBSITE: "Audit Website",
  SCORE_LEAD: "Run Score",
  REVIEW_OPPORTUNITY: "Review opportunity",
  ADD_CONTACT: "Add a contact",
  PREPARE_OUTREACH: "Prepare outreach",
  FOLLOW_UP: "Follow up",
  SCHEDULE_MEETING: "Schedule a meeting",
  SEND_PROPOSAL: "Send a proposal",
  NO_ACTION: "No action needed",
}

export default async function ProspectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const business = await getBusinessById(supabase, id)
  if (!business) notFound()

  const [activities, salesStrategies, outreachDrafts] = await Promise.all([
    listRecentActivities(supabase, 30, { entityType: "business", entityId: id }),
    listSalesStrategies(supabase, id),
    listOutreachDrafts(supabase, id),
  ])

  const activeStrategy = salesStrategies.find((s) => s.status === "ACTIVE") ?? null
  const strategyOpportunity = activeStrategy
    ? (business.opportunities.find((o) => o.id === activeStrategy.opportunity_id) ?? null)
    : null
  const strategyContact = activeStrategy?.target_contact_id
    ? (business.contacts.find((c) => c.id === activeStrategy.target_contact_id) ?? null)
    : null

  const latestResearch = business.research_notes[0] ?? null
  const digitalPresence = (latestResearch?.digital_presence ?? {}) as DigitalPresence

  const latestAudit = business.audits[0] ?? null
  const earlierAudits = business.audits.slice(1)

  const activeOpportunities = business.opportunities.filter(
    (o) => o.status !== "REJECTED" && o.status !== "CLOSED"
  )
  const topOpportunity =
    [...activeOpportunities].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))[0] ?? null
  const sortedOpportunities = [...business.opportunities].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))

  const nextAction = getNextAction(business)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/prospects" className="hover:underline">
              Prospects
            </Link>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold">{business.name}</h1>
            <Badge variant="outline">{business.pipeline_status}</Badge>
            {business.lead_score && (
              <Badge variant="secondary">
                {business.lead_score.total_score}/100 - {business.lead_score.classification}
              </Badge>
            )}
            {latestAudit?.overall_score !== null && latestAudit?.overall_score !== undefined && (
              <Badge variant="outline">Website {latestAudit.overall_score}/100</Badge>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ResearchScoreActions businessId={business.id} />
          <StatusControl businessId={business.id} currentStatus={business.pipeline_status} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Why this business?</CardTitle>
            <CardDescription>
              The strongest reason to reach out, composed from what&apos;s already on file - not a fresh AI call.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {topOpportunity ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{topOpportunity.title}</p>
                  <Badge variant={priorityVariant(topOpportunity.priority)}>{topOpportunity.priority}</Badge>
                  {topOpportunity.score !== null && <Badge variant="outline">{topOpportunity.score}/100</Badge>}
                </div>
                {topOpportunity.evidence && <Field label="Evidence (why contact)" value={topOpportunity.evidence} />}
                {topOpportunity.recommended_service && (
                  <Field label="Recommended service (what to offer)" value={topOpportunity.recommended_service} />
                )}
                {topOpportunity.expected_benefit && (
                  <Field label="Expected benefit (why it's valuable)" value={topOpportunity.expected_benefit} />
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No active opportunities identified yet. Run Research and Audit Website above to find one.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Next recommended action</CardTitle>
            <CardDescription>A deterministic recommendation, never an automatic send - review and act manually.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Badge variant="secondary" className="w-fit">
              {NEXT_ACTION_LABELS[nextAction.action]}
            </Badge>
            <p className="text-sm text-muted-foreground">{nextAction.reason}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sales intelligence</CardTitle>
          <CardDescription>
            {activeStrategy
              ? `Generated ${new Date(activeStrategy.generated_at).toLocaleString()} - confidence ${Math.round((activeStrategy.confidence ?? 0) * 100)}%${salesStrategies.length > 1 ? ` (${salesStrategies.length} strategies on file)` : ""}`
              : "No sales strategy yet - use Generate Outreach below to build one from existing research, audit, and opportunities."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeStrategy ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Why contact this business?" value={activeStrategy.primary_problem} />
              <Field label="Primary opportunity" value={strategyOpportunity?.title ?? "-"} />
              <Field label="Recommended service" value={activeStrategy.recommended_service} />
              <Field label="Recommended channel" value={<Badge variant="outline">{activeStrategy.recommended_channel}</Badge>} />
              <div className="md:col-span-2">
                <Field
                  label="Evidence"
                  value={
                    <>
                      <Badge variant={activeStrategy.evidence_type === "OBSERVED" ? "success" : "secondary"} className="mr-2">
                        {activeStrategy.evidence_type}
                      </Badge>
                      {activeStrategy.supporting_evidence}
                    </>
                  }
                />
              </div>
              <div className="md:col-span-2">
                <Field label="Expected benefit" value={activeStrategy.expected_business_benefit} />
              </div>
              <Field
                label="Recommended contact"
                value={
                  strategyContact
                    ? `${strategyContact.name}${strategyContact.job_title ? ` (${strategyContact.job_title})` : ""}`
                    : "Business-level (no named contact on file)"
                }
              />
              <Field label="Priority" value={<Badge variant={priorityVariant(activeStrategy.priority)}>{activeStrategy.priority}</Badge>} />
              <div className="md:col-span-2">
                <Field label="Sales angle" value={activeStrategy.sales_angle} />
              </div>
              <div className="md:col-span-2">
                <Field label="Value proposition" value={activeStrategy.value_proposition} />
              </div>
              {(activeStrategy.things_to_avoid as string[]).length > 0 && (
                <div className="md:col-span-2">
                  <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Things to avoid</p>
                  <ul className="list-disc pl-4 text-sm text-muted-foreground">
                    {(activeStrategy.things_to_avoid as string[]).map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Generate outreach below once research, audit, and at least one opportunity are on file.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outreach</CardTitle>
          <CardDescription>Generated drafts for human review - nothing is ever sent automatically.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <GenerateOutreachAction businessId={business.id} hasExisting={outreachDrafts.length > 0} />
          {outreachDrafts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No outreach drafts yet.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {outreachDrafts.map((draft) => (
                <OutreachDraftCard key={`${draft.id}-${draft.updated_at}`} businessId={business.id} draft={draft} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Business overview</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Industry" value={business.industry} />
            <Field label="Location" value={business.location ?? [business.city, business.country].filter(Boolean).join(", ")} />
            <Field
              label="Website"
              value={
                business.website ? (
                  <a href={business.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {business.website}
                  </a>
                ) : null
              }
            />
            <Field label="Phone" value={business.phone} />
            <Field label="Email" value={business.email} />
            <Field label="WhatsApp" value={whatsappLabel(business.whatsapp_status)} />
            <Field label="Source" value={business.source} />
            <Field
              label="Source URL"
              value={
                business.source_url ? (
                  <a href={business.source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    View
                  </a>
                ) : null
              }
            />
            {business.description && (
              <div className="col-span-2">
                <Field label="Description" value={business.description} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Digital presence</CardTitle>
            <CardDescription>
              {latestResearch ? `From research on ${new Date(latestResearch.researched_at).toLocaleDateString()}` : "No research recorded yet"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {latestResearch ? (
              <div className="flex flex-col gap-2 text-sm">
                {(Object.keys(DIGITAL_PRESENCE_LABELS) as (keyof typeof DIGITAL_PRESENCE_LABELS)[]).map((key) => (
                  <div key={key} className="flex items-center justify-between">
                    <span>{DIGITAL_PRESENCE_LABELS[key]}</span>
                    <Badge variant={digitalPresence[key] ? "success" : "secondary"}>
                      {digitalPresence[key] ? "Yes" : "No"}
                    </Badge>
                  </div>
                ))}
                {digitalPresence.social_platforms && digitalPresence.social_platforms.length > 0 && (
                  <p className="mt-1 text-muted-foreground">
                    Social: {digitalPresence.social_platforms.join(", ")}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Run Research to populate this.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lead score</CardTitle>
          <CardDescription>
            {business.lead_score
              ? `Scored ${new Date(business.lead_score.scored_at).toLocaleDateString()} - confidence ${Math.round((business.lead_score.confidence ?? 0) * 100)}%`
              : "Not scored yet."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {business.lead_score ? (
            <div className="flex flex-col gap-3">
              {SCORE_COMPONENTS.map((component) => {
                const reasoning = (business.lead_score!.reasoning as Record<string, string> | null)?.[component.reasoningKey]
                const score = (business.lead_score as unknown as Record<string, number>)[component.key]
                return (
                  <div key={component.key} className="flex flex-col gap-0.5 border-b border-border pb-2 last:border-0">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span>{component.label}</span>
                      <span>
                        {score}/{component.max}
                      </span>
                    </div>
                    {reasoning && <p className="text-sm text-muted-foreground">{reasoning}</p>}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Run Score to generate an explainable 0-100 score.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Website audit</CardTitle>
          <CardDescription>
            {latestAudit
              ? `Last audited ${new Date(latestAudit.audited_at).toLocaleString()} - ${latestAudit.audit_status}${
                  business.audits.length > 1 ? ` (${business.audits.length} audits on file)` : ""
                }`
              : "Not audited yet."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!latestAudit ? (
            <p className="text-sm text-muted-foreground">Run Audit Website above to assess this business&apos;s site.</p>
          ) : latestAudit.audit_status !== "COMPLETED" ? (
            <p className="text-sm text-muted-foreground">
              {latestAudit.access_notes ?? `Audit status: ${latestAudit.audit_status}`}
            </p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <p className="text-2xl font-semibold">{latestAudit.overall_score}/100</p>
                <p className="text-sm text-muted-foreground">overall score, weighted across 8 categories</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {AUDIT_CATEGORY_COMPONENTS.map((c) => (
                  <div key={c.key} className="rounded-md border border-border p-2 text-center">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</p>
                    <p className="text-lg font-medium">
                      {(latestAudit as unknown as Record<string, number | null>)[c.key] ?? "-"}
                    </p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <AuditColumn
                  title="Observed issues"
                  items={(latestAudit.observed_issues as AuditObservedIssue[]).map((i) => ({
                    category: i.category,
                    text: i.issue,
                  }))}
                  badgeVariant="outline"
                />
                <AuditColumn
                  title="Inferred issues"
                  items={(latestAudit.inferred_issues as AuditInferredIssue[]).map((i) => ({
                    category: i.category,
                    text: `${i.issue} (${i.basis})`,
                  }))}
                  badgeVariant="secondary"
                />
                <AuditColumn
                  title="Strengths"
                  items={(latestAudit.strengths as AuditStrength[]).map((s) => ({
                    category: s.category,
                    text: s.strength,
                  }))}
                  badgeVariant="success"
                />
                <AuditColumn
                  title="Recommendations"
                  items={(latestAudit.recommendations as AuditRecommendation[]).map((r) => ({
                    category: r.category,
                    text: r.recommendation,
                  }))}
                  badgeVariant="outline"
                />
              </div>
            </>
          )}

          {earlierAudits.length > 0 && (
            <details className="rounded-md border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Audit history ({earlierAudits.length} earlier audit{earlierAudits.length === 1 ? "" : "s"})
              </summary>
              <ul className="mt-3 flex flex-col divide-y divide-border text-sm">
                {earlierAudits.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground">{new Date(a.audited_at).toLocaleString()}</span>
                    <span>{a.audit_status}</span>
                    <span>{a.overall_score !== null ? `${a.overall_score}/100` : "-"}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI research summary</CardTitle>
          <CardDescription>
            {business.research_notes.length > 1
              ? `Latest of ${business.research_notes.length} research runs`
              : undefined}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {latestResearch ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <ResearchColumn
                title="Observed"
                items={(latestResearch.observations as Observation[]).map((o) => o.fact)}
              />
              <ResearchColumn
                title="Inferred"
                items={(latestResearch.inferences as Inference[]).map((i) => `${i.inference} (${i.basis})`)}
              />
              <ResearchColumn
                title="Recommended"
                items={(latestResearch.recommendations as Recommendation[]).map((r) => r.recommendation)}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No research recorded yet. Run Research above.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Potential opportunities</CardTitle>
          <CardDescription>
            Ranked by the explainable 0-100 score (business impact, evidence strength, customer need, commercial fit, urgency, feasibility).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {sortedOpportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No opportunities identified yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {sortedOpportunities.map((opportunity) => (
                <li key={opportunity.id} className="flex flex-col gap-2 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{opportunity.title}</p>
                    <Badge variant="outline">{opportunity.opportunity_type.replace(/_/g, " ")}</Badge>
                    <Badge variant={priorityVariant(opportunity.priority)}>{opportunity.priority}</Badge>
                    {opportunity.score !== null && <Badge variant="secondary">{opportunity.score}/100</Badge>}
                    {opportunity.estimated_complexity && (
                      <Badge variant="outline">{opportunity.estimated_complexity} complexity</Badge>
                    )}
                    {opportunity.times_detected > 1 && (
                      <Badge variant="outline">Detected {opportunity.times_detected}x</Badge>
                    )}
                  </div>
                  {opportunity.evidence && <Field label="Evidence" value={opportunity.evidence} />}
                  {opportunity.recommended_service && (
                    <Field label="Recommended service" value={opportunity.recommended_service} />
                  )}
                  {opportunity.expected_benefit && <Field label="Expected benefit" value={opportunity.expected_benefit} />}
                  {opportunity.problem && <p className="text-sm text-muted-foreground">Problem: {opportunity.problem}</p>}
                  {opportunity.proposed_solution && (
                    <p className="text-sm text-muted-foreground">Solution: {opportunity.proposed_solution}</p>
                  )}
                  {opportunity.score !== null && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-muted-foreground">Score breakdown</summary>
                      <div className="mt-2 flex flex-col gap-1">
                        {OPPORTUNITY_SCORE_COMPONENTS.map((component) => {
                          const value = (opportunity as unknown as Record<string, number | null>)[component.key]
                          const reasoning = (opportunity.score_reasoning as Record<string, string> | null)?.[
                            component.reasoningKey
                          ]
                          return (
                            <div key={component.key} className="flex flex-col gap-0.5">
                              <div className="flex items-center justify-between">
                                <span>{component.label}</span>
                                <span>
                                  {value ?? "-"}/{component.max}
                                </span>
                              </div>
                              {reasoning && <p className="text-xs text-muted-foreground">{reasoning}</p>}
                            </div>
                          )
                        })}
                      </div>
                    </details>
                  )}
                  <div className="mt-1">
                    <OpportunityStatusControl
                      businessId={business.id}
                      opportunityId={opportunity.id}
                      currentStatus={opportunity.status}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <AddOpportunityForm businessId={business.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contacts</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {business.contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contacts recorded yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {business.contacts.map((contact) => (
                <li key={contact.id} className="flex flex-col gap-1 py-3">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{contact.name}</p>
                    {contact.job_title && <span className="text-sm text-muted-foreground">{contact.job_title}</span>}
                    <Badge variant="outline">{contact.verification_status}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    {contact.email && <span>{contact.email}</span>}
                    {contact.phone && <span>{contact.phone}</span>}
                    <span>WhatsApp: {whatsappLabel(contact.whatsapp_status)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <AddContactForm businessId={business.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeed activities={activities} />
        </CardContent>
      </Card>
    </div>
  )
}

function whatsappLabel(status: string): string {
  if (status === "AVAILABLE") return "Available"
  if (status === "NOT_AVAILABLE") return "Not available"
  return "Unknown"
}

function priorityVariant(priority: Enums<"opportunity_priority">): "destructive" | "warning" | "secondary" | "outline" {
  switch (priority) {
    case "CRITICAL":
      return "destructive"
    case "HIGH":
      return "warning"
    case "MEDIUM":
      return "secondary"
    default:
      return "outline"
  }
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p>{value || <span className="text-muted-foreground">Not set</span>}</p>
    </div>
  )
}

function ResearchColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">None</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {items.map((item, index) => (
            <li key={index} className="text-muted-foreground">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AuditColumn({
  title,
  items,
  badgeVariant,
}: {
  title: string
  items: { category: string; text: string }[]
  badgeVariant: "outline" | "secondary" | "success"
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">None</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {items.map((item, index) => (
            <li key={index} className="text-muted-foreground">
              <Badge variant={badgeVariant} className="mr-1">
                {item.category}
              </Badge>
              {item.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
