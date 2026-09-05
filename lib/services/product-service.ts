import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Tables } from "@/lib/types/database.types"

export async function listProducts(
  supabase: SupabaseClient<Database>
): Promise<Tables<"products">[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("name", { ascending: true })

  if (error) throw new Error(`Failed to load products: ${error.message}`)
  return data
}

export async function getProductBySlug(
  supabase: SupabaseClient<Database>,
  slug: string
): Promise<Tables<"products"> | null> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("slug", slug)
    .maybeSingle()

  if (error) throw new Error(`Failed to load product: ${error.message}`)
  return data
}
