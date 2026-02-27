"use server"

import { db, sql } from "../database";
import { Order } from "@/lib/types";

// Function to reopen a closed order
export async function openOrder(params: {
  tenantId: string;
  orderId: Order['id'];
}): Promise<Order> {
  return await db
    .updateTable('orders')
    .set({ closed: sql`null` })
    .where('id', '=', params.orderId)
    .where('tenant_id', '=', params.tenantId)
    .returningAll()
    .executeTakeFirstOrThrow()
}
