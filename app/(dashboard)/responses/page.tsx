import Link from "next/link"

import { createClient } from "@/lib/supabase/server"
import { listConversationSummaries, listUnmatchedMessages } from "@/lib/services/response-dashboard-service"
import { Constants, type Enums } from "@/lib/types/database.types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AssignUnmatchedMessageForm } from "@/components/responses/assign-unmatched-message-form"

type SearchParams = {
  status?: string
  channel?: string
  intent?: string
  industry?: string
  crm_stage?: string
}

function statusBadgeVariant(status: Enums<"conversation_status">): "success" | "warning" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "WAITING_FOR_US":
      return "warning"
    case "WAITING_FOR_THEM":
      return "success"
    case "CLOSED":
      return "secondary"
    case "DO_NOT_CONTACT":
      return "destructive"
    default:
      return "outline"
  }
}

function intentBadgeVariant(intent: Enums<"response_intent"> | null): "success" | "warning" | "secondary" | "outline" | "destructive" {
  if (!intent) return "outline"
  if (["INTERESTED", "POSITIVE_GENERAL", "REQUEST_FOR_MEETING", "REQUEST_FOR_PRICING"].includes(intent)) return "success"
  if (["QUESTION", "OBJECTION"].includes(intent)) return "warning"
  if (["NOT_INTERESTED", "OPT_OUT", "NEGATIVE_GENERAL"].includes(intent)) return "destructive"
  return "secondary"
}

export default async function ResponsesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const supabase = await createClient()

  const [allConversations, unmatched, businesses] = await Promise.all([
    listConversationSummaries(supabase),
    listUnmatchedMessages(supabase),
    supabase.from("businesses").select("id, name").order("name").then((r) => r.data ?? []),
  ])

  const needsResponseCount = allConversations.filter((c) => c.status === "WAITING_FOR_US").length

  const status = Constants.public.Enums.conversation_status.includes(params.status as Enums<"conversation_status">)
    ? (params.status as Enums<"conversation_status">)
    : undefined
  const channel = Constants.public.Enums.outreach_channel.includes(params.channel as Enums<"outreach_channel">)
    ? (params.channel as Enums<"outreach_channel">)
    : undefined
  const intent = Constants.public.Enums.response_intent.includes(params.intent as Enums<"response_intent">)
    ? (params.intent as Enums<"response_intent">)
    : undefined
  const industry = params.industry || undefined
  const crmStage = Constants.public.Enums.pipeline_status.includes(params.crm_stage as Enums<"pipeline_status">)
    ? (params.crm_stage as Enums<"pipeline_status">)
    : undefined

  const filtered = allConversations.filter((c) => {
    if (status && c.status !== status) return false
    if (channel && c.channel !== channel) return false
    if (intent && c.latestMessage?.intent !== intent) return false
    if (industry && c.businessIndustry !== industry) return false
    if (crmStage && c.pipelineStatus !== crmStage) return false
    return true
  })

  const industries = [...new Set(allConversations.map((c) => c.businessIndustry).filter((v): v is string => !!v))].sort()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Responses</h1>
        <p className="text-sm text-muted-foreground">
          Who has replied, what it means, and what to do next - nothing here is ever sent automatically.
        </p>
      </div>

      {needsResponseCount > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-3 py-4">
            <span className="text-2xl">🔴</span>
            <div>
              <p className="text-lg font-semibold">
                {needsResponseCount} lead{needsResponseCount === 1 ? "" : "s"} need{needsResponseCount === 1 ? "s" : ""} your response
              </p>
              <Link href="/responses?status=WAITING_FOR_US" className="text-sm text-primary hover:underline">
                View them
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Status</label>
              <Select name="status" defaultValue={status ?? ""} className="w-44">
                <option value="">All</option>
                {Constants.public.Enums.conversation_status.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Channel</label>
              <Select name="channel" defaultValue={channel ?? ""} className="w-36">
                <option value="">All</option>
                {Constants.public.Enums.outreach_channel.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Intent</label>
              <Select name="intent" defaultValue={intent ?? ""} className="w-52">
                <option value="">All</option>
                {Constants.public.Enums.response_intent.map((i) => (
                  <option key={i} value={i}>
                    {i.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Industry</label>
              <Select name="industry" defaultValue={industry ?? ""} className="w-44">
                <option value="">All</option>
                {industries.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">CRM stage</label>
              <Select name="crm_stage" defaultValue={crmStage ?? ""} className="w-40">
                <option value="">All</option>
                {Constants.public.Enums.pipeline_status.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" size="sm">
              Apply
            </Button>
            {(status || channel || intent || industry || crmStage) && (
              <Link href="/responses">
                <Button type="button" size="sm" variant="ghost">
                  Clear
                </Button>
              </Link>
            )}
          </form>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {allConversations.length === 0
              ? "No conversations yet. They appear here as soon as a business replies to outreach."
              : "No conversations match these filters."}
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((c) => (
            <li key={c.id}>
              <Card>
                <CardContent className="flex flex-col gap-2 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/responses/${c.id}`} className="font-medium hover:underline">
                        {c.businessName}
                      </Link>
                      <Badge variant="outline">{c.channel}</Badge>
                      <Badge variant={statusBadgeVariant(c.status)}>{c.status.replace(/_/g, " ")}</Badge>
                      {c.unread_count > 0 && <Badge variant="warning">{c.unread_count} new</Badge>}
                      {c.leadScoreTotal !== null && <Badge variant="outline">{c.leadScoreTotal}/100</Badge>}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {c.last_message_at ? new Date(c.last_message_at).toLocaleString() : ""}
                    </span>
                  </div>

                  {c.latestMessage ? (
                    <>
                      <p className="text-sm italic text-muted-foreground">&ldquo;{c.latestMessage.message_body}&rdquo;</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {c.latestMessage.intent && <Badge variant={intentBadgeVariant(c.latestMessage.intent)}>{c.latestMessage.intent.replace(/_/g, " ")}</Badge>}
                        {c.latestMessage.sentiment && <Badge variant="outline">{c.latestMessage.sentiment}</Badge>}
                        {c.latestMessage.classification_status === "PENDING" && <Badge variant="secondary">Classifying...</Badge>}
                        {c.latestMessage.classification_status === "FAILED" && <Badge variant="destructive">Classification failed</Badge>}
                      </div>
                      {c.latestMessage.recommended_action && (
                        <p className="text-sm">
                          <span className="font-medium">Recommended: </span>
                          {c.latestMessage.recommended_action}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No inbound message on file for this conversation yet.</p>
                  )}

                  <div>
                    <Link href={`/responses/${c.id}`}>
                      <Button size="sm" variant="outline">
                        View Conversation
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {unmatched.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Unmatched messages</CardTitle>
            <CardDescription>
              Received but not confidently matched to a known business - assign manually rather than guessing.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {unmatched.map((m) => (
              <div key={m.id} className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{m.channel}</Badge>
                  <span className="text-muted-foreground">From: {m.sender_identifier}</span>
                  <span className="text-xs text-muted-foreground">{new Date(m.received_at).toLocaleString()}</span>
                </div>
                <p className="italic text-muted-foreground">&ldquo;{m.message_body}&rdquo;</p>
                <AssignUnmatchedMessageForm messageId={m.id} businesses={businesses} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
