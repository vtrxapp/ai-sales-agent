import Link from "next/link"
import { notFound } from "next/navigation"
import { Megaphone } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { getProductBySlug } from "@/lib/services/product-service"
import { listCampaigns } from "@/lib/services/campaign-service"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/dashboard/empty-state"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const product = await getProductBySlug(supabase, slug)

  if (!product) notFound()

  const campaigns = await listCampaigns(supabase, { productId: product.id })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{product.name}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{product.description}</p>
        </div>
        <Button asChild>
          <Link href={`/campaigns/new?product=${product.id}`}>New campaign</Link>
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description={`Create the first campaign for ${product.name} to start tracking it here.`}
          action={
            <Button asChild size="sm">
              <Link href={`/campaigns/new?product=${product.id}`}>New campaign</Link>
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
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
