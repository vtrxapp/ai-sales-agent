"use client"

import { useActionState, useState } from "react"

import { setDoNotContactAction, clearDoNotContactAction } from "@/app/actions/outreach"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// Suppression is enforced server-side inside sendOutreachMessage
// regardless of what this control shows (spec section 30) - this is
// purely the human-facing way to set/clear it, and a visible warning
// anywhere a send could be attempted from this business.
export function DoNotContactControl({
  businessId,
  doNotContact,
  reason,
}: {
  businessId: string
  doNotContact: boolean
  reason: string | null
}) {
  const [setState, setAction, setPending] = useActionState(setDoNotContactAction, null)
  const [clearState, clearAction, clearPending] = useActionState(clearDoNotContactAction, null)
  const [showForm, setShowForm] = useState(false)

  if (doNotContact) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="destructive">Do Not Contact</Badge>
          {reason && <span className="text-sm text-muted-foreground">{reason}</span>}
        </div>
        <p className="text-sm text-muted-foreground">All outreach sends to this business are blocked.</p>
        <form action={clearAction}>
          <input type="hidden" name="business_id" value={businessId} />
          <Button type="submit" size="sm" variant="outline" disabled={clearPending}>
            {clearPending ? "Removing..." : "Remove Do Not Contact"}
          </Button>
        </form>
        {clearState?.error && <p className="text-sm text-destructive">{clearState.error}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {showForm ? (
        <form action={setAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="business_id" value={businessId} />
          <Input name="reason" placeholder="Reason (optional)" className="h-8 w-56" />
          <Button type="submit" size="sm" variant="destructive" disabled={setPending}>
            {setPending ? "Marking..." : "Confirm"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(true)}>
          Mark Do Not Contact
        </Button>
      )}
      {setState?.error && <p className="text-sm text-destructive">{setState.error}</p>}
    </div>
  )
}
