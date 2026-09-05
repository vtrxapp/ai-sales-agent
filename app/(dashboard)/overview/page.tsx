import Link from "next/link"
import { Sparkles } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { listProducts } from "@/lib/services/product-service"
import { getOverviewStats, getPipelineStats } from "@/lib/services/analytics-service"
import { listRecentActivities } from "@/lib/services/activity-service"
import { StatCard } from "@/components/dashboard/stat-card"
import { ActivityFeed } from "@/components/dashboard/activity-feed"
import { EmptyState } from "@/components/dashboard/empty-state"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default async function OverviewPage() {
  const supabase = await createClient()
  const [products, stats, pipelineStats, activities] = await Promise.all([
    listProducts(supabase),
    getOverviewStats(supabase),
    getPipelineStats(supabase),
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
