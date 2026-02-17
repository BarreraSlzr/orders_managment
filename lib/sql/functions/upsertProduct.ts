import { db } from '@/lib/sql/database';
import { Product } from '@/lib/types';

export async function upsertProduct(params: {
  tenantId: string;
  id?: string;
  name: string;
  price: number;
  tags: string;
}): Promise<Product> {
  if (params.id) {
    // Update existing product
    return await db
      .updateTable('products')
      .set({ name: params.name, price: params.price, tags: params.tags })
      .where('id', '=', params.id)
      .where('tenant_id', '=', params.tenantId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  // Insert new product
  return await db
    .insertInto('products')
    .values({
      tenant_id: params.tenantId,
      name: params.name,
      price: params.price,
      tags: params.tags,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}
