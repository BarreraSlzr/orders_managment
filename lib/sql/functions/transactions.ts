import { db } from "../database";

export async function addTransaction(
  item_id: string,
  type: 'IN' | 'OUT',
  price: number,
  quantity: number,
  quantity_type_value: string
) {
  return await db
    .insertInto('transactions')
    .values({
      item_id,
      type,
      price,
      quantity,
      quantity_type_value,
    })
    .execute();
}

export async function deleteTransaction(transactionId: number) {
  return await db.deleteFrom('transactions').where('id', '=', transactionId).execute();
}

export async function getTransactions(itemId: string) {
    return db
      .selectFrom('transactions')
      .selectAll()
      .where('item_id', '=', itemId)
      .execute();
  }