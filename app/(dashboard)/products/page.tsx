import Link from "next/link"

import { createClient } from "@/lib/supabase/server"
import { listProducts } from "@/lib/services/product-service"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default async function ProductsPage() {
  const supabase = await createClient()
  const products = await listProducts(supabase)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Products</h1>
        <p className="text-sm text-muted-foreground">
          The two business objectives the Growth Engine operates on.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {products.map((product) => (
          <Link key={product.id} href={`/products/${product.slug}`}>
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{product.name}</CardTitle>
                  <Badge variant={product.active ? "success" : "secondary"}>
                    {product.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <CardDescription>{product.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm text-primary hover:underline">View campaigns and details &rarr;</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
