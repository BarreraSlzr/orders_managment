"use server"

import { Product } from "@/lib/types";
import { db } from "../database";

// Function to get products based on search and tags
export async function getProducts(params: {
  tenantId: string;
  search?: string;
  tags?: string[];
}): Promise<Product[]> {
    let query = db
      .selectFrom('products')
      .where('tenant_id', '=', params.tenantId)
      .where('deleted', 'is', null)  // Only include non-deleted products

    if (params.search) {
        query = query.where('name', 'ilike', `%${params.search}%`)
    }

    const tags = params.tags ?? [];
    if (tags.length > 0) {
        query = query.where((eb) => eb.and(
            tags.map(
                tag => eb('tags', 'ilike', `%${tag}%`)
            )
        ))
    }

    return await query
      .selectAll()
      .orderBy('created', 'desc')
      .execute()
}