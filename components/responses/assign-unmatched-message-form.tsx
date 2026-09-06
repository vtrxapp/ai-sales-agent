"use client"

import { useActionState } from "react"

import { assignUnmatchedMessageAction } from "@/app/actions/responses"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"

export function AssignUnmatchedMessageForm({
  messageId,
  businesses,
}: {
  messageId: string
  businesses: { id: string; name: string }[]
}) {
  const [state, action, pending] = useActionState(assignUnmatchedMessageAction, null)

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="message_id" value={messageId} />
      <Select name="business_id" className="w-64" defaultValue="" required>
        <option value="" disabled>
          Assign to business...
        </option>
        {businesses.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </Select>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Assigning..." : "Assign"}
      </Button>
      {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
      {state?.success && <span className="text-sm text-success">{state.success}</span>}
    </form>
  )
}
