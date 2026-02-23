"use server"

import { sql } from "kysely";
import { db } from "../database";

export async function getItems(params: {
  tenantId: string;
  categoryId?: string;
}) {
  return await db
    .selectFrom('inventory_items')
    .select([
      'id',
      'tenant_id',
      'name',
      'created',
      'deleted',
      'quantity_type_key',
      'status',
      'updated',
      sql<boolean>`exists (
        select 1 from category_inventory_item as ci
        where ci.item_id = inventory_items.id
          and ci.tenant_id = ${params.tenantId}
      )`.as('hasCategory'),
      // Net stock: sum of IN movements minus sum of OUT movements
      sql<number>`coalesce((
        select sum(case when type = 'IN' then quantity else -quantity end)
        from transactions t
        where t.item_id = inventory_items.id
          and t.tenant_id = ${params.tenantId}
      ), 0)`.as('stock'),
    ])
    .where('inventory_items.tenant_id', '=', params.tenantId)
    .$if(!!params.categoryId, (qb) =>
      qb.where(sql<boolean>`exists (
        select 1 from category_inventory_item as ci
        where ci.item_id = inventory_items.id
          and ci.tenant_id = ${params.tenantId}
          and ci.category_id = ${params.categoryId}
      )`)
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

/**
 * Returns items whose net stock (IN minus OUT) is below their min_stock threshold.
 * Only items with min_stock set (not null) are included.
 */
export async function getLowStockAlerts(params: { tenantId: string }) {
  return await db
    .selectFrom('inventory_items')
    .select([
      'id',
      'name',
      'quantity_type_key',
      'min_stock',
      sql<number>`coalesce((
        select sum(case when type = 'IN' then quantity else -quantity end)
        from transactions t
        where t.item_id = inventory_items.id
          and t.tenant_id = ${params.tenantId}
      ), 0)`.as('stock'),
    ])
    .where('tenant_id', '=', params.tenantId)
    .where('deleted', 'is', null)
    .where('min_stock', 'is not', null)
    .where(
      sql<boolean>`coalesce((
        select sum(case when type = 'IN' then quantity else -quantity end)
        from transactions t
        where t.item_id = inventory_items.id
          and t.tenant_id = ${params.tenantId}
      ), 0) < inventory_items.min_stock`
    )
    .execute();
}

export async function deleteItem(params: { tenantId: string; id: string }) {
  return await db
    .deleteFrom('inventory_items')
    .where('id', '=', params.id)
    .where('tenant_id', '=', params.tenantId)
    .execute();
}