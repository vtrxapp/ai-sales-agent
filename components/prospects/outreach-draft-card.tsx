"use client"

import { useActionState, useState } from "react"

import {
  editOutreachDraftAction,
  approveOutreachDraftAction,
  rejectOutreachDraftAction,
  sendOutreachDraftAction,
  retryOutreachSendAction,
} from "@/app/actions/outreach"
import type { Tables } from "@/lib/types/database.types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type ValidationIssue = { code: string; message: string }
type PersonalizationBreakdown = Record<string, number>
export type ResolvedRecipient = { name: string | null; phone?: string | null; email?: string | null } | null

function statusVariant(status: string): "success" | "warning" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "SENT":
    case "READY_TO_SEND":
    case "APPROVED":
      return "success"
    case "NEEDS_REVIEW":
    case "SENDING":
      return "warning"
    case "CANCELLED":
    case "FAILED":
      return "destructive"
    default:
      return "secondary"
  }
}

// Keyed by `${draft.id}-${draft.updated_at}` from the parent list, so a
// successful edit/approve/reject/send (which revalidates the page and
// changes updated_at) remounts this component with fresh initial state
// instead of needing manual client-state sync with the server-updated
// draft.
export function OutreachDraftCard({
  businessId,
  businessName,
  draft,
  recipient,
  senderIdentity,
  providerConfigured,
  doNotContact,
  latestSendAttempt,
}: {
  businessId: string
  businessName: string
  draft: Tables<"outreach_drafts">
  recipient: ResolvedRecipient
  senderIdentity: string | null
  providerConfigured: boolean
  doNotContact: boolean
  latestSendAttempt: Tables<"outreach_send_attempts"> | null
}) {
  const [editing, setEditing] = useState(false)
  const [confirmingSend, setConfirmingSend] = useState(false)
  const [body, setBody] = useState(draft.body)
  const [subject, setSubject] = useState(draft.subject ?? "")
  const [editState, editAction, editPending] = useActionState(editOutreachDraftAction, null)
  const [approveState, approveAction, approvePending] = useActionState(approveOutreachDraftAction, null)
  const [rejectState, rejectAction, rejectPending] = useActionState(rejectOutreachDraftAction, null)
  const [sendState, sendAction, sendPending] = useActionState(sendOutreachDraftAction, null)
  const [retryState, retryAction, retryPending] = useActionState(retryOutreachSendAction, null)

  const issues = (draft.validation_errors as ValidationIssue[] | null) ?? []
  const breakdown = (draft.personalization_reasoning as PersonalizationBreakdown | null) ?? {}
  const canApprove = draft.validation_status === "PASSED" && (draft.status === "DRAFT" || draft.status === "NEEDS_REVIEW")
  const canEdit = draft.status !== "SENT" && draft.status !== "SENDING"
  const canReject = draft.status !== "SENT" && draft.status !== "SENDING" && draft.status !== "CANCELLED"
  const recipientAddress = draft.channel === "WHATSAPP" ? recipient?.phone : recipient?.email
  const canSend = draft.status === "READY_TO_SEND" && providerConfigured && !doNotContact && !!recipientAddress

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

          {draft.status === "SENT" && latestSendAttempt && (
            <div className="rounded-md border border-success/40 bg-success/5 p-3 text-sm">
              <p className="font-medium text-success">Sent</p>
              <p className="text-muted-foreground">
                {new Date(latestSendAttempt.completed_at ?? latestSendAttempt.attempted_at).toLocaleString()} via{" "}
                {latestSendAttempt.provider} to {latestSendAttempt.recipient_address}
              </p>
              {latestSendAttempt.provider_message_id && (
                <p className="text-muted-foreground">Provider message ID: {latestSendAttempt.provider_message_id}</p>
              )}
            </div>
          )}

          {draft.status === "FAILED" && latestSendAttempt && (
            <div className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-destructive">Send failed</p>
              <p className="text-muted-foreground">{latestSendAttempt.error_message}</p>
              {latestSendAttempt.retryable === false ? (
                <p className="text-muted-foreground">
                  This needs a fix, not a retry - check the recipient, template, or provider configuration, or edit the draft.
                </p>
              ) : (
                <form action={retryAction}>
                  <input type="hidden" name="draft_id" value={draft.id} />
                  <input type="hidden" name="business_id" value={businessId} />
                  <Button type="submit" size="sm" variant="outline" disabled={retryPending}>
                    {retryPending ? "Retrying..." : "Retry send"}
                  </Button>
                </form>
              )}
            </div>
          )}

          {confirmingSend && (
            <div className="flex flex-col gap-2 rounded-md border border-warning/50 bg-warning/5 p-3 text-sm">
              <p className="font-medium">Confirm send</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-muted-foreground">Business</dt>
                <dd>{businessName}</dd>
                <dt className="text-muted-foreground">Channel</dt>
                <dd>{draft.channel}</dd>
                <dt className="text-muted-foreground">Recipient</dt>
                <dd>
                  {recipient?.name ? `${recipient.name} - ` : ""}
                  {recipientAddress ?? "none available"}
                </dd>
                <dt className="text-muted-foreground">Sender</dt>
                <dd>{senderIdentity ?? "not configured"}</dd>
              </dl>
              {!providerConfigured && (
                <p className="text-destructive">
                  {draft.channel} sending is not configured. Set the required environment variables before this can be sent.
                </p>
              )}
              {doNotContact && <p className="text-destructive">This contact is marked Do Not Contact - sending is blocked.</p>}
              {!recipientAddress && providerConfigured && (
                <p className="text-destructive">No valid {draft.channel === "WHATSAPP" ? "WhatsApp number" : "email address"} is on file.</p>
              )}
              <p className="text-muted-foreground">This will send the message exactly as shown above. This cannot be undone.</p>
              <div className="flex gap-2">
                <form action={sendAction}>
                  <input type="hidden" name="draft_id" value={draft.id} />
                  <input type="hidden" name="business_id" value={businessId} />
                  <Button type="submit" size="sm" disabled={!canSend || sendPending}>
                    {sendPending ? "Sending..." : "Send this message now"}
                  </Button>
                </form>
                <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmingSend(false)} disabled={sendPending}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            <form action={approveAction}>
              <input type="hidden" name="draft_id" value={draft.id} />
              <input type="hidden" name="business_id" value={businessId} />
              <Button type="submit" size="sm" disabled={!canApprove || approvePending}>
                {approvePending ? "Approving..." : draft.status === "READY_TO_SEND" ? "Approved" : "Approve"}
              </Button>
            </form>
            {draft.status === "READY_TO_SEND" && !confirmingSend && (
              <Button size="sm" onClick={() => setConfirmingSend(true)}>
                Send
              </Button>
            )}
            {canReject && (
              <form action={rejectAction}>
                <input type="hidden" name="draft_id" value={draft.id} />
                <input type="hidden" name="business_id" value={businessId} />
                <Button type="submit" size="sm" variant="destructive" disabled={rejectPending}>
                  {rejectPending ? "Rejecting..." : "Reject"}
                </Button>
              </form>
            )}
          </div>
        </>
      )}
      {editState?.error && <p className="text-sm text-destructive">{editState.error}</p>}
      {approveState?.error && <p className="text-sm text-destructive">{approveState.error}</p>}
      {rejectState?.error && <p className="text-sm text-destructive">{rejectState.error}</p>}
      {sendState?.error && <p className="text-sm text-destructive">{sendState.error}</p>}
      {sendState?.success && <p className="text-sm text-success">{sendState.success}</p>}
      {retryState?.error && <p className="text-sm text-destructive">{retryState.error}</p>}
    </li>
  )
}
