import Link from "next/link"
import { notFound } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getBusinessById } from "@/lib/services/business-service"
import { listRecentActivities } from "@/lib/services/activity-service"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ActivityFeed } from "@/components/dashboard/activity-feed"
import { ResearchScoreActions } from "@/components/prospects/research-score-actions"
import { StatusControl } from "@/components/prospects/status-control"
import { AddContactForm } from "@/components/prospects/add-contact-form"
import { AddOpportunityForm } from "@/components/prospects/add-opportunity-form"

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

const SCORE_COMPONENTS = [
  { key: "industry_fit_score", max: 20, label: "Industry fit", reasoningKey: "industry_fit" },
  { key: "digital_problems_score", max: 20, label: "Digital problems", reasoningKey: "digital_problems" },
  { key: "missing_functionality_score", max: 20, label: "Missing functionality", reasoningKey: "missing_functionality" },
  { key: "business_potential_score", max: 15, label: "Business potential", reasoningKey: "business_potential" },
  { key: "contactability_score", max: 10, label: "Contactability", reasoningKey: "contactability" },
  { key: "growth_potential_score", max: 10, label: "Growth potential", reasoningKey: "growth_potential" },
  { key: "other_score", max: 5, label: "Other", reasoningKey: "other" },
] as const

const DIGITAL_PRESENCE_LABELS: Record<keyof Omit<DigitalPresence, "social_platforms" | "notes">, string> = {
  has_website: "Website",
  has_online_booking: "Online booking",
  has_ecommerce: "E-commerce",
  has_customer_portal: "Customer portal",
  has_mobile_app: "Mobile app",
  has_online_forms: "Online forms",
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

  const activities = await listRecentActivities(supabase, 30, { entityType: "business", entityId: id })

  const latestResearch = business.research_notes[0] ?? null
  const digitalPresence = (latestResearch?.digital_presence ?? {}) as DigitalPresence

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
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {business.opportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No opportunities identified yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {business.opportunities.map((opportunity) => (
                <li key={opportunity.id} className="flex flex-col gap-1 py-3">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{opportunity.title}</p>
                    <Badge variant="outline">{opportunity.opportunity_type.replace(/_/g, " ")}</Badge>
                    <Badge variant={opportunity.priority === "HIGH" ? "warning" : "secondary"}>
                      {opportunity.priority}
                    </Badge>
                  </div>
                  {opportunity.problem && <p className="text-sm text-muted-foreground">Problem: {opportunity.problem}</p>}
                  {opportunity.proposed_solution && (
                    <p className="text-sm text-muted-foreground">Solution: {opportunity.proposed_solution}</p>
                  )}
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
