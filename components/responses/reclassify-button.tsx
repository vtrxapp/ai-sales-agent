"use client"

import { useActionState } from "react"

import { reclassifyMessageAction } from "@/app/actions/responses"
import { Button } from "@/components/ui/button"

export function ReclassifyButton({ messageId, conversationId }: { messageId: string; conversationId: string }) {
  const [state, action, pending] = useActionState(reclassifyMessageAction, null)

  return (
    <div className="flex flex-col gap-1">
      <form action={action}>
        <input type="hidden" name="message_id" value={messageId} />
        <input type="hidden" name="conversation_id" value={conversationId} />
        <Button type="submit" size="sm" variant="ghost" disabled={pending}>
          {pending ? "Reclassifying..." : "Reclassify"}
        </Button>
      </form>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </div>
  )
}
