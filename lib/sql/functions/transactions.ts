import { sql } from "kysely";
import { db } from "../database";

/**
 * Upsert a transaction: INSERT when no id is provided, UPDATE (also allowing
 * changing item / unit / price) when id is present.
 */
export async function upsertTransaction(params: {
  tenantId: string;
  itemId: string;
  type: 'IN' | 'OUT';
  price: number;
  quantity: number;
  quantityTypeValue: string;
  id?: number;
}) {
  if (params.id != null) {
    return await db
      .updateTable('transactions')
      .set({
        item_id: params.itemId,
        quantity: params.quantity,
        price: params.price,
        quantity_type_value: params.quantityTypeValue,
      })
      .where('id', '=', params.id)
      .where('tenant_id', '=', params.tenantId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }
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
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function deleteTransaction(params: {
  tenantId: string;
  id: number;
}) {
  const results = await db
    .deleteFrom('transactions')
    .where('id', '=', params.id)
    .where('tenant_id', '=', params.tenantId)
    .execute();
  // Kysely returns BigInt in numDeletedRows — coerce to number so tRPC can serialize it.
  return { numDeletedRows: Number(results[0]?.numDeletedRows ?? 0) };
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

/**
 * Returns total cost and count of IN (gasto) transactions for a given calendar
 * date (ISO string: "YYYY-MM-DD"), grouped by item so the summary can be
 * rendered per-item or collapsed to a single row.
 */
export async function getDailyGastos(params: {
  tenantId: string;
  date: string; // 'YYYY-MM-DD'
}) {
  return db
    .selectFrom('transactions as t')
    .innerJoin('inventory_items as ii', 'ii.id', 't.item_id')
    .select([
      'ii.name as item_name',
      sql<number>`cast(sum(t.quantity) as int)`.as('total_quantity'),
      sql<number>`cast(sum(t.price) as int)`.as('total_cost'),
      sql<number>`cast(count(*) as int)`.as('count'),
      't.quantity_type_value',
    ])
    .where('t.tenant_id', '=', params.tenantId)
    .where('t.type', '=', 'IN')
    .where(sql<string>`date(t.created)`, '=', params.date)
    .groupBy(['ii.name', 't.quantity_type_value'])
    .orderBy('ii.name')
    .execute();
}

/**
 * Returns individual IN transactions for a given calendar date with their IDs
 * so each gasto can be edited or deleted independently.
 */
export async function getGastosByDate(params: {
  tenantId: string;
  date: string; // 'YYYY-MM-DD'
}) {
  return db
    .selectFrom('transactions as t')
    .innerJoin('inventory_items as ii', 'ii.id', 't.item_id')
    .select([
      't.id',
      't.item_id',
      'ii.name as item_name',
      't.quantity',
      't.quantity_type_value',
      't.price',
      't.created',
    ])
    .where('t.tenant_id', '=', params.tenantId)
    .where('t.type', '=', 'IN')
    .where(sql<string>`date(t.created)`, '=', params.date)
    .orderBy('t.created', 'desc')
    .execute();
}

