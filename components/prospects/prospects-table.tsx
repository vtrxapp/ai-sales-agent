"use client"

import Link from "next/link"
import { useActionState, useState } from "react"

import {
  bulkResearchAction,
  bulkScoreAction,
  bulkUpdateStatusAction,
} from "@/app/actions/businesses"
import type { BusinessListItem } from "@/lib/services/business-service"
import { Constants, type Enums } from "@/lib/types/database.types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const MAX_BULK_AI_OPS = 10

function classificationVariant(
  classification: Enums<"lead_classification"> | null | undefined
): "default" | "success" | "warning" | "secondary" {
  switch (classification) {
    case "EXCEPTIONAL":
    case "HIGH":
      return "success"
    case "MEDIUM":
      return "warning"
    default:
      return "secondary"
  }
}

export function ProspectsTable({ businesses }: { businesses: BusinessListItem[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [researchState, researchAction, researchPending] = useActionState(bulkResearchAction, null)
  const [scoreState, scoreAction, scorePending] = useActionState(bulkScoreAction, null)
  const [statusState, statusAction, statusPending] = useActionState(bulkUpdateStatusAction, null)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === businesses.length ? new Set() : new Set(businesses.map((b) => b.id))))
  }

  const bulkPending = researchPending || scorePending || statusPending
  const overAiCap = selected.size > MAX_BULK_AI_OPS

  return (
    <form className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <span className="text-sm font-medium">{selected.size} selected</span>
        <Button
          type="submit"
          formAction={researchAction}
          size="sm"
          variant="outline"
          disabled={selected.size === 0 || overAiCap || bulkPending}
        >
          {researchPending ? "Researching..." : "Bulk research"}
        </Button>
        <Button
          type="submit"
          formAction={scoreAction}
          size="sm"
          variant="outline"
          disabled={selected.size === 0 || overAiCap || bulkPending}
        >
          {scorePending ? "Scoring..." : "Bulk score"}
        </Button>
        <div className="flex items-center gap-2">
          <Select name="status" defaultValue="" className="h-8 text-xs" disabled={selected.size === 0}>
            <option value="" disabled>
              Set status to...
            </option>
            {Constants.public.Enums.pipeline_status.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
          <Button
            type="submit"
            formAction={statusAction}
            size="sm"
            variant="outline"
            disabled={selected.size === 0 || bulkPending}
          >
            {statusPending ? "Updating..." : "Apply"}
          </Button>
        </div>
        {overAiCap && (
          <span className="text-xs text-warning">
            Select {MAX_BULK_AI_OPS} or fewer for bulk research/score.
          </span>
        )}
      </div>

      {researchState?.error && <p className="text-sm text-destructive">{researchState.error}</p>}
      {researchState?.summary && <p className="text-sm text-muted-foreground">{researchState.summary}</p>}
      {scoreState?.error && <p className="text-sm text-destructive">{scoreState.error}</p>}
      {scoreState?.summary && <p className="text-sm text-muted-foreground">{scoreState.summary}</p>}
      {statusState?.error && <p className="text-sm text-destructive">{statusState.error}</p>}
      {statusState?.summary && <p className="text-sm text-muted-foreground">{statusState.summary}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <input
                type="checkbox"
                className="size-4"
                checked={selected.size === businesses.length && businesses.length > 0}
                onChange={toggleAll}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead>Business</TableHead>
            <TableHead>Industry</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Lead score</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Website</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Opportunities</TableHead>
            <TableHead>Outreach</TableHead>
            <TableHead>Last researched</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {businesses.map((business) => (
            <TableRow key={business.id}>
              <TableCell>
                <input
                  type="checkbox"
                  name="business_ids"
                  value={business.id}
                  checked={selected.has(business.id)}
                  onChange={() => toggle(business.id)}
                  className="size-4"
                  aria-label={`Select ${business.name}`}
                />
              </TableCell>
              <TableCell>
                <Link href={`/prospects/${business.id}`} className="font-medium hover:underline">
                  {business.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{business.industry ?? "-"}</TableCell>
              <TableCell className="text-muted-foreground">
                {business.city ?? business.location ?? "-"}
              </TableCell>
              <TableCell>{business.lead_score ? `${business.lead_score.total_score}/100` : "-"}</TableCell>
              <TableCell>
                {business.lead_score ? (
                  <Badge variant={classificationVariant(business.lead_score.classification)}>
                    {business.lead_score.classification}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">Not scored</span>
                )}
              </TableCell>
              <TableCell>
                {business.latest_audit?.overall_score !== null && business.latest_audit?.overall_score !== undefined ? (
                  `${business.latest_audit.overall_score}/100`
                ) : business.latest_audit ? (
                  <span className="text-muted-foreground">{business.latest_audit.audit_status}</span>
                ) : (
                  <span className="text-muted-foreground">Not audited</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{business.pipeline_status}</Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                <div className="flex flex-col gap-0.5">
                  {business.website && <span>Website</span>}
                  {business.phone && <span>Phone</span>}
                  {business.email && <span>Email</span>}
                  {business.whatsapp_status === "AVAILABLE" && <span>WhatsApp</span>}
                  {!business.website && !business.phone && !business.email && "None found"}
                </div>
              </TableCell>
              <TableCell>
                {business.opportunity_count > 0 ? (
                  <span>
                    {business.opportunity_count}
                    {business.top_opportunity_score !== null ? ` (top ${business.top_opportunity_score}/100)` : ""}
                  </span>
                ) : (
                  0
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {business.has_approved_draft && <Badge variant="success">Approved</Badge>}
                  {business.needs_review && <Badge variant="warning">Needs review</Badge>}
                  {!business.has_approved_draft && !business.needs_review && business.has_outreach_draft && (
                    <Badge variant="secondary">Drafted</Badge>
                  )}
                  {!business.has_outreach_draft && business.has_active_sales_strategy && (
                    <Badge variant="outline">Strategy only</Badge>
                  )}
                  {!business.has_active_sales_strategy && !business.has_outreach_draft && (
                    <span className="text-muted-foreground">-</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {business.last_researched_at
                  ? new Date(business.last_researched_at).toLocaleDateString()
                  : "Never"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </form>
  )
}
