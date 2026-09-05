import Link from "next/link"
import { notFound } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getCampaignById } from "@/lib/services/campaign-service"
import { listRecentActivities } from "@/lib/services/activity-service"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ActivityFeed } from "@/components/dashboard/activity-feed"

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{value ?? <span className="text-muted-foreground">Not set</span>}</p>
    </div>
  )
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const campaign = await getCampaignById(supabase, id)

  if (!campaign) notFound()

  const activities = await listRecentActivities(supabase, 20, { campaignId: campaign.id })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/campaigns" className="hover:underline">
            Campaigns
          </Link>{" "}
          / {campaign.products?.name}
        </p>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-xl font-semibold">{campaign.name}</h1>
          <Badge variant="outline">{campaign.status}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Product" value={campaign.products?.name} />
          <Field label="Campaign type" value={campaign.campaign_type} />
          <Field label="Objective" value={campaign.objective} />
          <Field label="Target location" value={campaign.target_location} />
          <Field label="Target audience" value={campaign.target_audience} />
          <Field
            label="Budget"
            value={campaign.budget ? `$${Number(campaign.budget).toLocaleString()}` : null}
          />
          <Field
            label="Start date"
            value={campaign.start_date ? new Date(campaign.start_date).toLocaleDateString() : null}
          />
          <Field
            label="End date"
            value={campaign.end_date ? new Date(campaign.end_date).toLocaleDateString() : null}
          />
          {campaign.description && (
            <div className="sm:col-span-2">
              <Field label="Description" value={campaign.description} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeed activities={activities} />
        </CardContent>
      </Card>
    </div>
  )
}
