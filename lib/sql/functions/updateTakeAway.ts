import { OrderItemTable } from "@/lib/types";
import { db, sql } from "../database";

export async function toggleTakeAway(item_ids: OrderItemTable['id'][]) {
  return await db
    .updateTable("order_items")
    .set({ is_takeaway: sql`CASE WHEN is_takeaway = TRUE THEN FALSE ELSE TRUE END` })
    .where("id", "in", item_ids)
    .returning(['id', 'product_id', 'payment_option_id', 'is_takeaway'])
    .execute();
}

export async function removeProducts(item_ids: OrderItemTable['id'][]) {
  return await db
    .deleteFrom("order_items")
    .where("id", "in", item_ids)
    .execute();
}

export async function togglePaymentOption(item_ids: OrderItemTable['id'][]) {
  return await db
    .updateTable("order_items")
    .set({ payment_option_id: sql`CASE WHEN payment_option_id = 1 THEN 2 ELSE 1 END` })
    .where("id", "in", item_ids)
    .returning(['id', 'product_id', 'payment_option_id', 'is_takeaway'])
    .execute();
}