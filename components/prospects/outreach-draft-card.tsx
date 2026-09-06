"use client"

import { useActionState, useState } from "react"

import {
  editOutreachDraftAction,
  approveOutreachDraftAction,
  rejectOutreachDraftAction,
} from "@/app/actions/outreach"
import type { Tables } from "@/lib/types/database.types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type ValidationIssue = { code: string; message: string }
type PersonalizationBreakdown = Record<string, number>

function statusVariant(status: string): "success" | "warning" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "READY_TO_SEND":
    case "APPROVED":
      return "success"
    case "NEEDS_REVIEW":
      return "warning"
    case "CANCELLED":
      return "destructive"
    default:
      return "secondary"
  }
}

// Keyed by `${draft.id}-${draft.updated_at}` from the parent list, so a
// successful edit/approve/reject (which revalidates the page and changes
// updated_at) remounts this component with fresh initial state instead
// of needing manual client-state sync with the server-updated draft.
export function OutreachDraftCard({ businessId, draft }: { businessId: string; draft: Tables<"outreach_drafts"> }) {
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(draft.body)
  const [subject, setSubject] = useState(draft.subject ?? "")
  const [editState, editAction, editPending] = useActionState(editOutreachDraftAction, null)
  const [approveState, approveAction, approvePending] = useActionState(approveOutreachDraftAction, null)
  const [rejectState, rejectAction, rejectPending] = useActionState(rejectOutreachDraftAction, null)

  const issues = (draft.validation_errors as ValidationIssue[] | null) ?? []
  const breakdown = (draft.personalization_reasoning as PersonalizationBreakdown | null) ?? {}
  const canApprove = draft.validation_status === "PASSED" && draft.status !== "CANCELLED" && draft.status !== "READY_TO_SEND"

  return (
    <li className="flex flex-col gap-2 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{draft.channel}</Badge>
        <Badge variant="secondary">{draft.variant}</Badge>
        <Badge variant={statusVariant(draft.status)}>{draft.status.replace(/_/g, " ")}</Badge>
        <Badge variant={draft.validation_status === "PASSED" ? "success" : "destructive"}>
          Validation: {draft.validation_status}
        </Badge>
        {draft.personalization_score !== null && (
          <Badge variant="outline">Personalization {draft.personalization_score}/100</Badge>
        )}
        {draft.is_user_edited && <Badge variant="outline">Edited</Badge>}
        <span className="text-xs text-muted-foreground">{new Date(draft.generated_at).toLocaleString()}</span>
      </div>

      {issues.length > 0 && (
        <ul className="list-disc pl-4 text-sm text-destructive">
          {issues.map((issue) => (
            <li key={issue.code}>{issue.message}</li>
          ))}
        </ul>
      )}

      {editing ? (
        <form action={editAction} className="flex flex-col gap-2">
          <input type="hidden" name="draft_id" value={draft.id} />
          <input type="hidden" name="business_id" value={businessId} />
          {draft.channel === "EMAIL" && (
            <Input name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
          )}
          <Textarea name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={editPending}>
              {editPending ? "Saving..." : "Save"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          {draft.subject && <p className="text-sm font-medium">Subject: {draft.subject}</p>}
          <p className="whitespace-pre-wrap text-sm">{draft.body}</p>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Personalization breakdown</summary>
            <ul className="mt-1 flex flex-col gap-0.5">
              {Object.entries(breakdown).map(([key, value]) => (
                <li key={key} className="flex justify-between">
                  <span>{key.replace(/_/g, " ")}</span>
                  <span>{value}</span>
                </li>
              ))}
            </ul>
          </details>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <form action={approveAction}>
              <input type="hidden" name="draft_id" value={draft.id} />
              <input type="hidden" name="business_id" value={businessId} />
              <Button type="submit" size="sm" disabled={!canApprove || approvePending}>
                {approvePending ? "Approving..." : draft.status === "READY_TO_SEND" ? "Approved" : "Approve"}
              </Button>
            </form>
            <form action={rejectAction}>
              <input type="hidden" name="draft_id" value={draft.id} />
              <input type="hidden" name="business_id" value={businessId} />
              <Button type="submit" size="sm" variant="destructive" disabled={draft.status === "CANCELLED" || rejectPending}>
                {rejectPending ? "Rejecting..." : "Reject"}
              </Button>
            </form>
          </div>
        </>
      )}
      {editState?.error && <p className="text-sm text-destructive">{editState.error}</p>}
      {approveState?.error && <p className="text-sm text-destructive">{approveState.error}</p>}
      {rejectState?.error && <p className="text-sm text-destructive">{rejectState.error}</p>}
    </li>
  )
}
