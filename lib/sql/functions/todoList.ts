"use server"

import { db } from "../database";

export async function getAllItems() {
    return await db.selectFrom('items').selectAll().execute();
  }
  
  export async function addItem(name: string) {
    return await db.insertInto('items').values({ name, status: 'pending' }).execute();
  }
  
  export async function toggleItem(id: string) {
    const item = await db.selectFrom('items').select('status').where('id', '=', id).executeTakeFirst();
    if (item) {
      const newStatus = item.status === 'completed' ? 'pending' : 'completed';
      return await db.updateTable('items').set({ status: newStatus }).where('id', '=', id).execute();
    }
  }
  
  export async function deleteItem(id: string) {
    return await db.deleteFrom('items').where('id', '=', id).execute();
  }