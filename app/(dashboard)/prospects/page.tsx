import Link from "next/link"
import { Building2 } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { listBusinesses, type BusinessListSort } from "@/lib/services/business-service"
import { Constants, type Enums } from "@/lib/types/database.types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/dashboard/empty-state"
import { ProspectsTable } from "@/components/prospects/prospects-table"

type SearchParams = {
  industry?: string
  location?: string
  status?: string
  classification?: string
  min_score?: string
  has_website?: string
  has_phone?: string
  has_whatsapp?: string
  has_email?: string
  has_opportunities?: string
  min_website_score?: string
  min_opportunity_score?: string
  opportunity_type?: string
  never_contacted?: string
  recently_audited?: string
  sort?: string
  saved?: string
  duplicates?: string
}

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const sort = (params.sort as BusinessListSort) || "discovered_desc"
  const status = Constants.public.Enums.pipeline_status.includes(params.status as Enums<"pipeline_status">)
    ? (params.status as Enums<"pipeline_status">)
    : undefined
  const classification = Constants.public.Enums.lead_classification.includes(
    params.classification as Enums<"lead_classification">
  )
    ? (params.classification as Enums<"lead_classification">)
    : undefined
  const opportunityType = Constants.public.Enums.opportunity_type.includes(
    params.opportunity_type as Enums<"opportunity_type">
  )
    ? (params.opportunity_type as Enums<"opportunity_type">)
    : undefined
  const businesses = await listBusinesses(
    supabase,
    {
      industry: params.industry || undefined,
      location: params.location || undefined,
      status,
      classification,
      minScore: params.min_score ? Number(params.min_score) : undefined,
      hasWebsite: params.has_website === "on",
      hasPhone: params.has_phone === "on",
      hasWhatsapp: params.has_whatsapp === "on",
      hasEmail: params.has_email === "on",
      hasOpportunities: params.has_opportunities === "on",
      minWebsiteScore: params.min_website_score ? Number(params.min_website_score) : undefined,
      minOpportunityScore: params.min_opportunity_score ? Number(params.min_opportunity_score) : undefined,
      opportunityType,
      neverContacted: params.never_contacted === "on",
      recentlyAudited: params.recently_audited === "on",
    },
    sort
  )

  const hasAnyFilter = Object.entries(params).some(
    ([key, value]) => key !== "saved" && key !== "duplicates" && key !== "sort" && !!value
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Prospects</h1>
          <p className="text-sm text-muted-foreground">
            Every business the Growth Engine has discovered, researched, or scored.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/leads">Find leads</Link>
        </Button>
      </div>

      {params.saved && (
        <p className="rounded-md border border-border bg-card p-3 text-sm">
          Saved {params.saved} business{params.saved === "1" ? "" : "es"}
          {params.duplicates && Number(params.duplicates) > 0
            ? ` (${params.duplicates} matched an existing record and were updated instead of duplicated).`
            : "."}
        </p>
      )}

      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Input name="industry" placeholder="Industry" defaultValue={params.industry} />
              <Input name="location" placeholder="Location" defaultValue={params.location} />
              <Select name="status" defaultValue={params.status ?? ""}>
                <option value="">Any status</option>
                {Constants.public.Enums.pipeline_status.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
              <Select name="classification" defaultValue={params.classification ?? ""}>
                <option value="">Any priority</option>
                {Constants.public.Enums.lead_classification.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Input
                name="min_score"
                type="number"
                min={0}
                max={100}
                placeholder="Min lead score"
                defaultValue={params.min_score}
              />
              <Input
                name="min_website_score"
                type="number"
                min={0}
                max={100}
                placeholder="Min website score"
                defaultValue={params.min_website_score}
              />
              <Input
                name="min_opportunity_score"
                type="number"
                min={0}
                max={100}
                placeholder="Min opportunity score"
                defaultValue={params.min_opportunity_score}
              />
              <Select name="opportunity_type" defaultValue={params.opportunity_type ?? ""}>
                <option value="">Any opportunity type</option>
                {Constants.public.Enums.opportunity_type.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
              <Select name="sort" defaultValue={sort}>
                <option value="discovered_desc">Recently discovered</option>
                <option value="researched_desc">Recently researched</option>
                <option value="score_desc">Highest lead score</option>
                <option value="website_score_desc">Highest website score</option>
                <option value="opportunity_score_desc">Highest opportunity score</option>
                <option value="opportunities_desc">Most opportunities</option>
                <option value="status">Status</option>
              </Select>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="has_website" defaultChecked={params.has_website === "on"} className="size-4" />
                Has website
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="has_phone" defaultChecked={params.has_phone === "on"} className="size-4" />
                Has phone
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="has_whatsapp" defaultChecked={params.has_whatsapp === "on"} className="size-4" />
                Has WhatsApp
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="has_email" defaultChecked={params.has_email === "on"} className="size-4" />
                Has email
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="has_opportunities"
                  defaultChecked={params.has_opportunities === "on"}
                  className="size-4"
                />
                Has opportunities
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="never_contacted"
                  defaultChecked={params.never_contacted === "on"}
                  className="size-4"
                />
                Never contacted
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="recently_audited"
                  defaultChecked={params.recently_audited === "on"}
                  className="size-4"
                />
                Recently audited (30d)
              </label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                Apply filters
              </Button>
              {hasAnyFilter && (
                <Button asChild size="sm" variant="ghost">
                  <Link href="/prospects">Clear</Link>
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {businesses.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={hasAnyFilter ? "No prospects match these filters" : "No prospects yet"}
          description={
            hasAnyFilter
              ? "Try clearing or broadening your filters."
              : "Find leads to start building your prospect database."
          }
          action={
            !hasAnyFilter ? (
              <Button asChild size="sm">
                <Link href="/leads">Find leads</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ProspectsTable businesses={businesses} />
      )}
    </div>
  )
}
