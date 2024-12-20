"use server"

import { db } from "../database";

export async function getItems(categoryId?: string) {
  return await db
    .selectFrom('inventory_items')
    .leftJoin('category_inventory_item',
       'inventory_items.id',
      'category_inventory_item.item_id')
    .select([
      'id',
      'name',
      'created',
      'deleted',
      'quantity_type_key',
      'status',
      'updated'
    ])
    .$if(!!categoryId, (qb) => qb
      .where('category_inventory_item.category_id', '=', `${categoryId}`)
    )
    .execute();
}

export async function addItem(name: string, quantity_type_key: string) {
  return await db.insertInto('inventory_items')
  .values({ name, quantity_type_key, status: 'pending' })
  .returningAll()
  .executeTakeFirstOrThrow();
}

export async function toggleItem(id: string) {
  const item = await db.selectFrom('inventory_items').select('status').where('id', '=', id).executeTakeFirst();
  if (item) {
    const newStatus = item.status === 'completed' ? 'pending' : 'completed';
    return await db.updateTable('inventory_items').set({ status: newStatus }).where('id', '=', id).execute();
  }
}

export async function deleteItem(id: string) {
  return await db.deleteFrom('inventory_items').where('id', '=', id).execute();
}