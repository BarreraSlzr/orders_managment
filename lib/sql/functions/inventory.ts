"use server"

import { db } from "../database";

export async function getItems(params: {
  tenantId: string;
  categoryId?: string;
}) {
  return await db
    .selectFrom('inventory_items')
    .leftJoin('category_inventory_item', (join) =>
      join
        .onRef('inventory_items.id', '=', 'category_inventory_item.item_id')
        .on('category_inventory_item.tenant_id', '=', params.tenantId)
    )
    .select([
      'id',
      'name',
      'created',
      'deleted',
      'quantity_type_key',
      'status',
      'updated'
    ])
    .where('inventory_items.tenant_id', '=', params.tenantId)
    .$if(!!params.categoryId, (qb) => qb
      .where('category_inventory_item.category_id', '=', `${params.categoryId}`)
    )
    .execute();
}

export async function addItem(params: {
  tenantId: string;
  name: string;
  quantityTypeKey: string;
}) {
  return await db.insertInto('inventory_items')
  .values({
    tenant_id: params.tenantId,
    name: params.name,
    quantity_type_key: params.quantityTypeKey,
    status: 'pending'
  })
  .returningAll()
  .executeTakeFirstOrThrow();
}

export async function toggleItem(params: { tenantId: string; id: string }) {
  const item = await db
    .selectFrom('inventory_items')
    .select('status')
    .where('id', '=', params.id)
    .where('tenant_id', '=', params.tenantId)
    .executeTakeFirst();
  if (item) {
    const newStatus = item.status === 'completed' ? 'pending' : 'completed';
    return await db
      .updateTable('inventory_items')
      .set({ status: newStatus })
      .where('id', '=', params.id)
      .where('tenant_id', '=', params.tenantId)
      .execute();
  }
}

export async function deleteItem(params: { tenantId: string; id: string }) {
  return await db
    .deleteFrom('inventory_items')
    .where('id', '=', params.id)
    .where('tenant_id', '=', params.tenantId)
    .execute();
}