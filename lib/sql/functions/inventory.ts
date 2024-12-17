"use server"

import { db } from "../database";

export async function getAllItems() {
  return await db.selectFrom('inventory_items').selectAll().execute();
}

export async function addItem(name: string, quantity_type_key: string) {
  return await db.insertInto('inventory_items').values({ name, quantity_type_key, status: 'pending' }).execute();
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