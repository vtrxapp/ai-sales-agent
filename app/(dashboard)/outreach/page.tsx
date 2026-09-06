import Link from "next/link"

import { createClient } from "@/lib/supabase/server"
import { getWhatsAppConfigStatus, getEmailConfigStatus } from "@/lib/outreach"
import { listAllSendAttempts } from "@/lib/services/outreach-send-service"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"

export default async function OutreachPage() {
  const supabase = await createClient()
  const whatsappStatus = getWhatsAppConfigStatus()
  const emailStatus = getEmailConfigStatus()
  const sendAttempts = await listAllSendAttempts(supabase, 200)

  const sentCount = sendAttempts.filter((a) => a.status === "SENT").length
  const failedCount = sendAttempts.filter((a) => a.status === "FAILED").length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Outreach</h1>
        <p className="text-sm text-muted-foreground">
          Sending infrastructure status and the permanent record of every send attempt. Nothing is ever sent
          automatically - every row here came from an explicit human confirmation on a prospect&apos;s page.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">WhatsApp</CardTitle>
            <CardDescription>Official WhatsApp Business Platform (Meta Cloud API), template-based sends only.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <Badge variant={whatsappStatus.configured ? "success" : "destructive"} className="w-fit">
              {whatsappStatus.configured ? "Configured" : "Not configured"}
            </Badge>
            {whatsappStatus.configured ? (
              <>
                <StatusField label="Phone number ID" value={whatsappStatus.phoneNumberId} />
                <StatusField label="Template" value={`${whatsappStatus.templateName} (${whatsappStatus.templateLanguage})`} />
                <StatusField label="API version" value={whatsappStatus.apiVersion ?? "default"} />
                <StatusField label="Access token" value="********" />
              </>
            ) : (
              <p className="text-muted-foreground">
                Missing: {whatsappStatus.missingEnvVars.join(", ")}. See README.md for setup instructions.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Email</CardTitle>
            <CardDescription>Resend, behind the same provider-agnostic abstraction as WhatsApp.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <Badge variant={emailStatus.configured ? "success" : "destructive"} className="w-fit">
              {emailStatus.configured ? "Configured" : "Not configured"}
            </Badge>
            {emailStatus.configured ? (
              <>
                <StatusField label="From" value={emailStatus.fromName ? `${emailStatus.fromName} <${emailStatus.fromEmail}>` : emailStatus.fromEmail} />
                <StatusField label="API key" value="********" />
              </>
            ) : (
              <p className="text-muted-foreground">
                Missing: {emailStatus.missingEnvVars.join(", ")}. See README.md for setup instructions.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Send history</CardTitle>
          <CardDescription>
            {sendAttempts.length === 0
              ? "No send attempts yet, across any business."
              : `${sendAttempts.length} attempt${sendAttempts.length === 1 ? "" : "s"} shown (most recent first) - ${sentCount} sent, ${failedCount} failed.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sendAttempts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Approve a draft on a prospect&apos;s page and click Send to create the first record here.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sendAttempts.map((attempt) => (
                  <TableRow key={attempt.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {new Date(attempt.attempted_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Link href={`/prospects/${attempt.business_id}`} className="text-primary hover:underline">
                        {attempt.businessName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{attempt.channel}</Badge>
                    </TableCell>
                    <TableCell>{attempt.recipient_address}</TableCell>
                    <TableCell>
                      <Badge
                        variant={attempt.status === "SENT" ? "success" : attempt.status === "FAILED" ? "destructive" : "warning"}
                      >
                        {attempt.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{attempt.provider}</TableCell>
                    <TableCell className="max-w-64 truncate text-muted-foreground" title={attempt.error_message ?? attempt.provider_message_id ?? ""}>
                      {attempt.status === "SENT" ? attempt.provider_message_id : attempt.error_message}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatusField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-1 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  )
}
