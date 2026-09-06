"use client"

import { useActionState } from "react"

import { closeConversationAction, reopenConversationAction, markRepliedOutsideAppAction } from "@/app/actions/responses"
import type { Enums } from "@/lib/types/database.types"
import { Button } from "@/components/ui/button"

export function ConversationActions({ conversationId, status }: { conversationId: string; status: Enums<"conversation_status"> }) {
  const [closeState, closeAction, closePending] = useActionState(closeConversationAction, null)
  const [reopenState, reopenAction, reopenPending] = useActionState(reopenConversationAction, null)
  const [repliedState, repliedAction, repliedPending] = useActionState(markRepliedOutsideAppAction, null)

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        {status !== "CLOSED" && status !== "DO_NOT_CONTACT" && (
          <form action={repliedAction}>
            <input type="hidden" name="conversation_id" value={conversationId} />
            <Button type="submit" size="sm" variant="outline" disabled={repliedPending}>
              {repliedPending ? "Marking..." : "Mark replied outside the app"}
            </Button>
          </form>
        )}
        {status === "CLOSED" ? (
          <form action={reopenAction}>
            <input type="hidden" name="conversation_id" value={conversationId} />
            <Button type="submit" size="sm" variant="outline" disabled={reopenPending}>
              {reopenPending ? "Reopening..." : "Reopen"}
            </Button>
          </form>
        ) : (
          status !== "DO_NOT_CONTACT" && (
            <form action={closeAction}>
              <input type="hidden" name="conversation_id" value={conversationId} />
              <Button type="submit" size="sm" variant="destructive" disabled={closePending}>
                {closePending ? "Closing..." : "Close conversation"}
              </Button>
            </form>
          )
        )}
      </div>
      {closeState?.error && <p className="text-sm text-destructive">{closeState.error}</p>}
      {reopenState?.error && <p className="text-sm text-destructive">{reopenState.error}</p>}
      {repliedState?.error && <p className="text-sm text-destructive">{repliedState.error}</p>}
    </div>
  )
}
