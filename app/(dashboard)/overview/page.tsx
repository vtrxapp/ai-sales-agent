import Link from "next/link"
import { Sparkles } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { listProducts } from "@/lib/services/product-service"
import {
  getOverviewStats,
  getPipelineStats,
  getOutreachStats,
  getResponseStats,
  getOpportunityResponseStats,
} from "@/lib/services/analytics-service"
import { listRecentActivities } from "@/lib/services/activity-service"
import { StatCard } from "@/components/dashboard/stat-card"
import { ActivityFeed } from "@/components/dashboard/activity-feed"
import { EmptyState } from "@/components/dashboard/empty-state"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"

export default async function OverviewPage() {
  const supabase = await createClient()
  const [products, stats, pipelineStats, outreachStats, responseStats, opportunityResponseStats, activities] = await Promise.all([
    listProducts(supabase),
    getOverviewStats(supabase),
    getPipelineStats(supabase),
    getOutreachStats(supabase),
    getResponseStats(supabase),
    getOpportunityResponseStats(supabase),
    listRecentActivities(supabase, 10),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Growth overview</h1>
        <p className="text-sm text-muted-foreground">
          What&apos;s happening across Zviko Labs and the Dating App right now.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Products" value={stats.totalProducts} />
        <StatCard label="Total campaigns" value={stats.totalCampaigns} />
        <StatCard label="Active campaigns" value={stats.activeCampaigns} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Zviko Labs pipeline</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total prospects" value={pipelineStats.totalProspects} />
          <StatCard label="Qualified" value={pipelineStats.statusCounts.QUALIFIED} />
          <StatCard label="Meetings" value={pipelineStats.statusCounts.MEETING} />
          <StatCard label="Won" value={pipelineStats.statusCounts.WON} />
        </div>
        {pipelineStats.highValueUncontactedCount > 0 && (
          <p className="mt-3 text-sm">
            <Link href="/prospects?status=NEW&sort=score_desc" className="text-primary hover:underline">
              {pipelineStats.highValueUncontactedCount} high-scoring prospect
              {pipelineStats.highValueUncontactedCount === 1 ? "" : "s"} haven&apos;t been contacted yet
            </Link>
          </p>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Sales &amp; outreach intelligence</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Qualified" value={outreachStats.qualifiedProspects} />
          <StatCard label="With opportunities" value={outreachStats.prospectsWithOpportunities} />
          <StatCard label="Ready for outreach" value={outreachStats.prospectsReadyForOutreach} />
          <StatCard label="Drafts needing review" value={outreachStats.draftsAwaitingReview} />
          <StatCard label="Approved drafts" value={outreachStats.approvedDrafts} />
          <StatCard label="High-priority opportunities" value={outreachStats.highPriorityOpportunities} />
        </div>
        {outreachStats.draftsAwaitingReview > 0 && (
          <p className="mt-3 text-sm">
            <Link href="/prospects?needs_review=on" className="text-primary hover:underline">
              {outreachStats.draftsAwaitingReview} outreach draft{outreachStats.draftsAwaitingReview === 1 ? "" : "s"}{" "}
              need review
            </Link>
          </p>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Sending</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Sent via WhatsApp" value={outreachStats.messagesSentByChannel.WHATSAPP} />
          <StatCard label="Sent via Email" value={outreachStats.messagesSentByChannel.EMAIL} />
          <StatCard label="Send failures" value={outreachStats.sendFailures} />
          <StatCard
            label="Success rate"
            value={outreachStats.sendSuccessRate === null ? "-" : `${outreachStats.sendSuccessRate}%`}
          />
        </div>
        <p className="mt-3 text-sm">
          <Link href="/outreach" className="text-primary hover:underline">
            View provider status and full send history
          </Link>
        </p>
      </div>

      {responseStats.needsResponseCount > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-3 py-4">
            <span className="text-2xl">🔴</span>
            <div>
              <p className="text-lg font-semibold">
                {responseStats.needsResponseCount} lead{responseStats.needsResponseCount === 1 ? "" : "s"} need
                {responseStats.needsResponseCount === 1 ? "s" : ""} your response
              </p>
              <Link href="/responses?status=WAITING_FOR_US" className="text-sm text-primary hover:underline">
                View them
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Responses</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Response rate" value={responseStats.responseRate === null ? "-" : `${responseStats.responseRate}%`} />
          <StatCard label="WhatsApp response rate" value={responseStats.whatsappResponseRate === null ? "-" : `${responseStats.whatsappResponseRate}%`} />
          <StatCard label="Email response rate" value={responseStats.emailResponseRate === null ? "-" : `${responseStats.emailResponseRate}%`} />
          <StatCard label="Positive response rate" value={responseStats.positiveResponseRate === null ? "-" : `${responseStats.positiveResponseRate}%`} />
          <StatCard label="Meeting requests" value={responseStats.meetingRequestRate === null ? "-" : `${responseStats.meetingRequestRate}%`} />
          <StatCard label="Pricing requests" value={responseStats.pricingRequestRate === null ? "-" : `${responseStats.pricingRequestRate}%`} />
          <StatCard label="Objections" value={responseStats.objectionRate === null ? "-" : `${responseStats.objectionRate}%`} />
          <StatCard label="Opt-outs" value={responseStats.optOutRate === null ? "-" : `${responseStats.optOutRate}%`} />
        </div>
        <p className="mt-3 text-sm">
          <Link href="/responses" className="text-primary hover:underline">
            View all responses
          </Link>
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Sales funnel</h2>
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          <StatCard label="Contacted" value={responseStats.uniqueContactedCount} />
          <StatCard label="Responded" value={responseStats.uniqueRespondedCount} />
          <StatCard label="Interested" value={responseStats.interestedCount} />
          <StatCard label="Meeting" value={pipelineStats.statusCounts.MEETING} />
          <StatCard label="Proposal" value={pipelineStats.statusCounts.PROPOSAL} />
          <StatCard label="Won" value={pipelineStats.statusCounts.WON} />
        </div>
      </div>

      {opportunityResponseStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Which opportunities produce the most responses</CardTitle>
            <CardDescription>Real counts from sent outreach and replies - only opportunity types actually contacted appear here.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Opportunity type</TableHead>
                  <TableHead>Contacted</TableHead>
                  <TableHead>Responded</TableHead>
                  <TableHead>Interested</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opportunityResponseStats.map((o) => (
                  <TableRow key={o.opportunityType}>
                    <TableCell>{o.opportunityType.replace(/_/g, " ")}</TableCell>
                    <TableCell>{o.contactedCount}</TableCell>
                    <TableCell>{o.respondedCount}</TableCell>
                    <TableCell>{o.interestedCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {products.map((product) => (
          <Card key={product.id}>
            <CardHeader>
              <CardTitle className="text-base">{product.name}</CardTitle>
              <CardDescription>{product.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {stats.campaignsByProduct[product.id] ?? 0} campaign
                {(stats.campaignsByProduct[product.id] ?? 0) === 1 ? "" : "s"} ·{" "}
                <Link href={`/products/${product.slug}`} className="text-primary hover:underline">
                  View product
                </Link>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What should I do next?</CardTitle>
          <CardDescription>AI-generated growth recommendations, grounded in real data.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Sparkles}
            title="Not available yet"
            description="The AI Growth Advisor (Phase 8) synthesizes recommendations across leads, campaigns, and conversion data. It isn't built yet - the high-scoring-prospects nudge above is a real computed count, not an AI recommendation."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeed activities={activities} />
        </CardContent>
      </Card>
    </div>
  )
}
