import { OrderItemTable } from "@/lib/types";
import { db, sql } from "../database";

export async function toggleTakeAway(params: {
  tenantId: string;
  itemIds: OrderItemTable['id'][];
}) {
  return await db
    .updateTable("order_items")
    .set({ is_takeaway: sql`CASE WHEN is_takeaway = TRUE THEN FALSE ELSE TRUE END` })
    .where("id", "in", params.itemIds)
    .where("tenant_id", "=", params.tenantId)
    .returning(['id', 'product_id', 'payment_option_id', 'is_takeaway'])
    .execute();
}


export function togglePaymentOption(params: {
  tenantId: string;
  itemIds: OrderItemTable['id'][];
}) {
  return db
    .updateTable("order_items")
    .set({ payment_option_id: sql`CASE WHEN payment_option_id = 1 THEN 2 ELSE 1 END` })
    .where("id", "in", params.itemIds)
    .where("tenant_id", "=", params.tenantId)
    .returning(['id', 'product_id', 'payment_option_id', 'is_takeaway'])
    .execute();
}


export function removeProducts(params: {
  tenantId: string;
  orderId: string;
  itemIds: OrderItemTable['id'][];
}) {
  return db
    .deleteFrom("order_items")
    .where("id", "in", params.itemIds)
    .where("order_id", "=", params.orderId)
    .where("tenant_id", "=", params.tenantId)
    .execute();
}
