import { createClient } from "@/lib/supabase/server"
import { listProducts } from "@/lib/services/product-service"
import { CampaignForm } from "@/components/campaigns/campaign-form"

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>
}) {
  const { product } = await searchParams
  const supabase = await createClient()
  const products = await listProducts(supabase)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">New campaign</h1>
        <p className="text-sm text-muted-foreground">
          Campaigns start as drafts. You can activate them once they&apos;re ready.
        </p>
      </div>
      <CampaignForm products={products} defaultProductId={product} />
    </div>
  )
}
