import Link from "next/link"
import { Kanban } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { listBusinesses, type BusinessListItem } from "@/lib/services/business-service"
import { Constants, type Enums } from "@/lib/types/database.types"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/dashboard/empty-state"
import { StatusControl } from "@/components/prospects/status-control"

export default async function PipelinePage() {
  const supabase = await createClient()
  const businesses = await listBusinesses(supabase, {}, "status")

  if (businesses.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold">Sales pipeline</h1>
        <EmptyState
          icon={Kanban}
          title="No prospects yet"
          description="Find leads to start moving prospects through the pipeline."
        />
      </div>
    )
  }

  const columns = Constants.public.Enums.pipeline_status.map((status) => ({
    status,
    businesses: businesses.filter((b) => b.pipeline_status === status),
  }))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Sales pipeline</h1>
        <p className="text-sm text-muted-foreground">
          Move prospects between stages below. Every change is logged to the activity timeline.
        </p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {columns.map((column) => (
          <div key={column.status} className="flex w-72 shrink-0 flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{column.status}</h2>
              <Badge variant="secondary">{column.businesses.length}</Badge>
            </div>
            <div className="flex flex-col gap-2">
              {column.businesses.length === 0 ? (
                <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                  Nothing here
                </p>
              ) : (
                column.businesses.map((business) => <PipelineCard key={business.id} business={business} />)
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PipelineCard({ business }: { business: BusinessListItem }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <Link href={`/prospects/${business.id}`} className="font-medium hover:underline">
        {business.name}
      </Link>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {business.industry && <span>{business.industry}</span>}
        {business.lead_score && (
          <Badge variant="outline" className="text-[10px]">
            {business.lead_score.total_score}/100
          </Badge>
        )}
      </div>
      <StatusControl businessId={business.id} currentStatus={business.pipeline_status as Enums<"pipeline_status">} />
    </div>
  )
}
