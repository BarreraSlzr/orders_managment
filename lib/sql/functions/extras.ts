"use server"

import { db } from "../database";
import { Extra } from "../types";

export interface UpsertExtraParams {
  id?: string;
  name: string;
  price: number;
}

export async function upsertExtra(params: UpsertExtraParams): Promise<Extra> {
  const { id, name, price } = params;

  if (id) {
    const result = await db
      .updateTable('extras')
      .set({ name, price, updated: new Date() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return result;
  }

  const result = await db
    .insertInto('extras')
    .values({ name, price })
    .returningAll()
    .executeTakeFirstOrThrow();
  return result;
}

export async function deleteExtra(id: string): Promise<Extra> {
  const result = await db
    .updateTable('extras')
    .set({ deleted: new Date() })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow();
  return result;
}

export async function getExtras(): Promise<Extra[]> {
  return db
    .selectFrom('extras')
    .selectAll()
    .where('deleted', 'is', null)
    .orderBy('name', 'asc')
    .execute();
}

export interface ToggleOrderItemExtraParams {
  orderItemId: number;
  extraId: string;
}

export async function toggleOrderItemExtra(params: ToggleOrderItemExtraParams): Promise<{ action: 'added' | 'removed'; orderItemId: number; extraId: string }> {
  const { orderItemId, extraId } = params;

  // Check if the extra is already attached
  const existing = await db
    .selectFrom('order_item_extras')
    .select('id')
    .where('order_item_id', '=', orderItemId)
    .where('extra_id', '=', extraId)
    .executeTakeFirst();

  if (existing) {
    await db
      .deleteFrom('order_item_extras')
      .where('id', '=', existing.id)
      .execute();
    return { action: 'removed', orderItemId, extraId };
  }

  await db
    .insertInto('order_item_extras')
    .values({ order_item_id: orderItemId, extra_id: extraId })
    .execute();
  return { action: 'added', orderItemId, extraId };
}
