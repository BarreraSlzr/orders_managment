import { db } from "../database";

export async function addTransaction(params: {
  tenantId: string;
  itemId: string;
  type: 'IN' | 'OUT';
  price: number;
  quantity: number;
  quantityTypeValue: string;
}) {
  return await db
    .insertInto('transactions')
    .values({
      tenant_id: params.tenantId,
      item_id: params.itemId,
      type: params.type,
      price: params.price,
      quantity: params.quantity,
      quantity_type_value: params.quantityTypeValue,
    })
    .execute();
}

export async function deleteTransaction(params: {
  tenantId: string;
  id: number;
}) {
  return await db
    .deleteFrom('transactions')
    .where('id', '=', params.id)
    .where('tenant_id', '=', params.tenantId)
    .execute();
}

export async function getTransactions(params: {
  tenantId: string;
  itemId: string;
}) {
    return db
      .selectFrom('transactions')
      .selectAll()
      .where('item_id', '=', params.itemId)
      .where('tenant_id', '=', params.tenantId)
      .execute();
  }