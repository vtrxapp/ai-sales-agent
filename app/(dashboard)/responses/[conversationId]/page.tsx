import Link from "next/link"
import { notFound } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getConversationDetail } from "@/lib/services/response-dashboard-service"
import { listResponseDraftsForConversation } from "@/lib/services/response-draft-service"
import { resolveRecipient, listSendAttempts } from "@/lib/services/outreach-send-service"
import { getWhatsAppConfigStatus, getEmailConfigStatus } from "@/lib/outreach"
import type { Tables } from "@/lib/types/database.types"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ConversationActions } from "@/components/responses/conversation-actions"
import { ReclassifyButton } from "@/components/responses/reclassify-button"
import { ResponseComposer } from "@/components/responses/response-composer"

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ conversationId: string }>
}) {
  const { conversationId } = await params
  const supabase = await createClient()
  const detail = await getConversationDetail(supabase, conversationId)
  if (!detail) notFound()

  const { conversation, business, contact, strategy, leadScore, timeline } = detail
  const latestInbound = [...timeline].reverse().find((t) => t.direction === "INBOUND")
  const latestInboundMessage = latestInbound?.direction === "INBOUND" ? latestInbound.message : null

  const [responseDrafts, sendAttempts] = await Promise.all([
    listResponseDraftsForConversation(supabase, conversationId),
    listSendAttempts(supabase, business.id),
  ])

  const latestAttemptByDraft = new Map<string, Tables<"outreach_send_attempts">>()
  for (const attempt of sendAttempts) {
    if (!latestAttemptByDraft.has(attempt.outreach_draft_id)) {
      latestAttemptByDraft.set(attempt.outreach_draft_id, attempt)
    }
  }

  // Mirrors the prospect page's own sendContextFor - a preview only, the
  // send action re-verifies all of this itself server-side regardless.
  function sendContextForChannel(channel: typeof conversation.channel) {
    if (channel === "WHATSAPP") {
      const status = getWhatsAppConfigStatus()
      return { providerConfigured: status.configured, senderIdentity: status.configured ? status.phoneNumberId : null }
    }
    const status = getEmailConfigStatus()
    return { providerConfigured: status.configured, senderIdentity: status.configured ? status.fromEmail : null }
  }
  const { providerConfigured, senderIdentity } = sendContextForChannel(conversation.channel)
  const recipient = resolveRecipient(conversation.channel, contact, business)

  const currentRoundDrafts = latestInboundMessage
    ? responseDrafts.filter((d) => d.response_to_message_id === latestInboundMessage.id)
    : []
  const priorRoundDrafts = latestInboundMessage
    ? responseDrafts.filter((d) => d.response_to_message_id !== latestInboundMessage.id)
    : responseDrafts
  const isOptedOut = business.do_not_contact || conversation.status === "DO_NOT_CONTACT" || latestInboundMessage?.intent === "OPT_OUT"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/responses" className="hover:underline">
              Responses
            </Link>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold">{business.name}</h1>
            <Badge variant="outline">{conversation.channel}</Badge>
            <Badge variant="outline">{conversation.status.replace(/_/g, " ")}</Badge>
            <Link href={`/prospects/${business.id}`} className="text-sm text-primary hover:underline">
              View prospect page
            </Link>
          </div>
        </div>
        <ConversationActions conversationId={conversation.id} status={conversation.status} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Business</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <p>{business.industry ?? "Unknown industry"}</p>
            {leadScore && (
              <p className="text-muted-foreground">
                Lead score: {leadScore.total_score}/100 ({leadScore.classification})
              </p>
            )}
            <p className="text-muted-foreground">Pipeline: {business.pipeline_status}</p>
            {business.do_not_contact && <Badge variant="destructive" className="w-fit">Do Not Contact</Badge>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {contact ? (
              <>
                <p>
                  {contact.name}
                  {contact.job_title ? ` - ${contact.job_title}` : ""}
                </p>
                {contact.whatsapp_number && <p className="text-muted-foreground">WhatsApp: {contact.whatsapp_number}</p>}
                {contact.email && <p className="text-muted-foreground">Email: {contact.email}</p>}
              </>
            ) : (
              <p className="text-muted-foreground">No named contact - business-level conversation.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Opportunity</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {strategy ? (
              <>
                <p>{strategy.recommended_service}</p>
                <p className="text-muted-foreground">{strategy.primary_problem}</p>
              </>
            ) : (
              <p className="text-muted-foreground">No active sales strategy on file.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {latestInbound?.direction === "INBOUND" && (
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader>
            <CardTitle className="text-base">Latest response - sales intelligence</CardTitle>
            <CardDescription>What this means and what to consider doing next.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              {latestInbound.message.intent && <Badge variant="outline">Intent: {latestInbound.message.intent.replace(/_/g, " ")}</Badge>}
              {latestInbound.message.sentiment && <Badge variant="outline">Sentiment: {latestInbound.message.sentiment}</Badge>}
              {latestInbound.message.urgency && <Badge variant="outline">Urgency: {latestInbound.message.urgency}</Badge>}
              {latestInbound.message.classification_status === "PENDING" && <Badge variant="secondary">Classifying...</Badge>}
              {latestInbound.message.classification_status === "FAILED" && <Badge variant="destructive">Classification failed</Badge>}
            </div>
            {latestInbound.message.recommended_action && (
              <p>
                <span className="font-medium">Recommended action: </span>
                {latestInbound.message.recommended_action}
                {latestInbound.message.recommended_action_reason && (
                  <span className="text-muted-foreground"> - {latestInbound.message.recommended_action_reason}</span>
                )}
              </p>
            )}
            {latestInbound.message.classification_reasoning &&
              typeof latestInbound.message.classification_reasoning === "object" &&
              "text" in latestInbound.message.classification_reasoning && (
                <p className="text-muted-foreground">
                  Why: {String((latestInbound.message.classification_reasoning as { text: string }).text)}
                </p>
              )}
            <div>
              <ReclassifyButton messageId={latestInbound.message.id} conversationId={conversation.id} />
            </div>
          </CardContent>
        </Card>
      )}

      {latestInboundMessage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your response</CardTitle>
            <CardDescription>
              AI drafts a starting point from this conversation - you review, edit, and approve before anything sends
              through the same Send workflow as any other message.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponseComposer
              conversationId={conversation.id}
              businessId={business.id}
              businessName={business.name}
              isOptedOut={isOptedOut}
              currentRoundDrafts={currentRoundDrafts}
              priorRoundDrafts={priorRoundDrafts}
              recipient={recipient}
              senderIdentity={senderIdentity}
              providerConfigured={providerConfigured}
              latestSendAttemptByDraft={latestAttemptByDraft}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversation</CardTitle>
          <CardDescription>Chronological - your outbound sends and their replies.</CardDescription>
        </CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages recorded yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {timeline.map((entry, index) => (
                <li
                  key={index}
                  className={`flex flex-col gap-1 rounded-md border p-3 text-sm ${
                    entry.direction === "OUTBOUND" ? "ml-8 border-primary/30 bg-primary/5" : "mr-8 border-border"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{entry.direction === "OUTBOUND" ? "You" : business.name}</span>
                    <span className="text-xs text-muted-foreground">{new Date(entry.at).toLocaleString()}</span>
                  </div>
                  {entry.direction === "OUTBOUND" && entry.subject && <p className="font-medium">{entry.subject}</p>}
                  <p className="whitespace-pre-wrap">{entry.direction === "OUTBOUND" ? entry.body : entry.message.message_body}</p>
                  {entry.direction === "INBOUND" && entry.message.intent && (
                    <Badge variant="outline" className="w-fit">
                      {entry.message.intent.replace(/_/g, " ")}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
