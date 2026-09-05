import Link from "next/link"
import { Megaphone } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { listCampaigns } from "@/lib/services/campaign-service"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/dashboard/empty-state"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default async function CampaignsPage() {
  const supabase = await createClient()
  const campaigns = await listCampaigns(supabase)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            All campaigns across Zviko Labs and the Dating App.
          </p>
        </div>
        <Button asChild>
          <Link href="/campaigns/new">New campaign</Link>
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Create your first campaign to start tracking it here."
          action={
            <Button asChild size="sm">
              <Link href="/campaigns/new">New campaign</Link>
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((campaign) => (
              <TableRow key={campaign.id}>
                <TableCell>
                  <Link href={`/campaigns/${campaign.id}`} className="font-medium hover:underline">
                    {campaign.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {campaign.products?.name ?? "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">{campaign.campaign_type}</TableCell>
                <TableCell>
                  <Badge variant="outline">{campaign.status}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(campaign.created_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
