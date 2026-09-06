"use client"

import { useActionState } from "react"

import { generateResponseDraftAction, regenerateResponseDraftAction } from "@/app/actions/responses"
import type { Tables } from "@/lib/types/database.types"
import { Button } from "@/components/ui/button"
import { OutreachDraftCard, type ResolvedRecipient } from "@/components/prospects/outreach-draft-card"

// The "Generate Response" / review / approve / send composer for
// /responses/[conversationId] (spec section 17). Generation is its own
// action (below); everything after a draft exists - edit, approve, send,
// retry - reuses OutreachDraftCard and its existing Phase 4/5 actions
// completely unchanged, so there is exactly one send path in the app,
// not a second one for responses.
export function ResponseComposer({
  conversationId,
  businessId,
  businessName,
  isOptedOut,
  currentRoundDrafts,
  priorRoundDrafts,
  recipient,
  senderIdentity,
  providerConfigured,
  latestSendAttemptByDraft,
}: {
  conversationId: string
  businessId: string
  businessName: string
  isOptedOut: boolean
  currentRoundDrafts: Tables<"outreach_drafts">[]
  priorRoundDrafts: Tables<"outreach_drafts">[]
  recipient: ResolvedRecipient
  senderIdentity: string | null
  providerConfigured: boolean
  latestSendAttemptByDraft: Map<string, Tables<"outreach_send_attempts">>
}) {
  const [genState, genAction, genPending] = useActionState(generateResponseDraftAction, null)
  const [regenState, regenAction, regenPending] = useActionState(regenerateResponseDraftAction, null)
  const anyPending = genPending || regenPending

  if (isOptedOut) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
        <p className="font-medium text-destructive">Do Not Contact</p>
        <p className="text-muted-foreground">
          This prospect has opted out of further communication. A response draft cannot be generated.
        </p>
      </div>
    )
  }

  function draftCard(draft: Tables<"outreach_drafts">) {
    return (
      <OutreachDraftCard
        key={`${draft.id}-${draft.updated_at}`}
        businessId={businessId}
        businessName={businessName}
        draft={draft}
        recipient={recipient}
        senderIdentity={senderIdentity}
        providerConfigured={providerConfigured}
        doNotContact={false}
        latestSendAttempt={latestSendAttemptByDraft.get(draft.id) ?? null}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <form action={genAction}>
          <input type="hidden" name="conversation_id" value={conversationId} />
          <Button type="submit" size="sm" disabled={anyPending}>
            {genPending ? "Generating..." : "Generate Response"}
          </Button>
        </form>
        {currentRoundDrafts.length > 0 && (
          <form action={regenAction}>
            <input type="hidden" name="conversation_id" value={conversationId} />
            <Button type="submit" size="sm" variant="outline" disabled={anyPending}>
              {regenPending ? "Regenerating..." : "Regenerate"}
            </Button>
          </form>
        )}
      </div>
      {genState?.error && <p className="text-sm text-destructive">{genState.error}</p>}
      {genState?.success && <p className="text-sm text-muted-foreground">{genState.success}</p>}
      {regenState?.error && <p className="text-sm text-destructive">{regenState.error}</p>}
      {regenState?.success && <p className="text-sm text-muted-foreground">{regenState.success}</p>}

      {currentRoundDrafts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No draft yet - click Generate Response to have the AI propose a reply for you to review and edit.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">{currentRoundDrafts.map(draftCard)}</ul>
      )}

      {priorRoundDrafts.length > 0 && (
        <details className="rounded-md border border-border p-3 text-sm">
          <summary className="cursor-pointer font-medium">Earlier response drafts ({priorRoundDrafts.length})</summary>
          <ul className="mt-3 flex flex-col gap-4">{priorRoundDrafts.map(draftCard)}</ul>
        </details>
      )}
    </div>
  )
}
