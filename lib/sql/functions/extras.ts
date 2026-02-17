"use server"

import { db } from "../database";
import { Extra } from "../types";

export interface UpsertExtraParams {
  tenantId: string;
  id?: string;
  name: string;
  price: number;
}

export async function upsertExtra(params: UpsertExtraParams): Promise<Extra> {
  const { tenantId, id, name, price } = params;

  if (id) {
    const result = await db
      .updateTable('extras')
      .set({ name, price, updated: new Date() })
      .where('id', '=', id)
      .where('tenant_id', '=', tenantId)
      .returningAll()
      .executeTakeFirstOrThrow();
    return result;
  }

  const result = await db
    .insertInto('extras')
    .values({ tenant_id: tenantId, name, price })
    .returningAll()
    .executeTakeFirstOrThrow();
  return result;
}

export async function deleteExtra(params: {
  tenantId: string;
  id: string;
}): Promise<Extra> {
  const result = await db
    .updateTable('extras')
    .set({ deleted: new Date() })
    .where('id', '=', params.id)
    .where('tenant_id', '=', params.tenantId)
    .returningAll()
    .executeTakeFirstOrThrow();
  return result;
}

export async function getExtras(params: { tenantId: string }): Promise<Extra[]> {
  return db
    .selectFrom('extras')
    .selectAll()
    .where('deleted', 'is', null)
    .where('tenant_id', '=', params.tenantId)
    .orderBy('name', 'asc')
    .execute();
}

export interface ToggleOrderItemExtraParams {
  tenantId: string;
  orderItemId: number;
  extraId: string;
}

export async function toggleOrderItemExtra(params: ToggleOrderItemExtraParams): Promise<{ action: 'added' | 'removed'; orderItemId: number; extraId: string }> {
  const { tenantId, orderItemId, extraId } = params;

  // Check if the extra is already attached
  const existing = await db
    .selectFrom('order_item_extras')
    .select('id')
    .where('order_item_id', '=', orderItemId)
    .where('extra_id', '=', extraId)
    .where('tenant_id', '=', tenantId)
    .executeTakeFirst();

  if (existing) {
    await db
      .deleteFrom('order_item_extras')
      .where('id', '=', existing.id)
      .where('tenant_id', '=', tenantId)
      .execute();
    return { action: 'removed', orderItemId, extraId };
  }

  await db
    .insertInto('order_item_extras')
    .values({ order_item_id: orderItemId, extra_id: extraId, tenant_id: tenantId })
    .execute();
  return { action: 'added', orderItemId, extraId };
}
