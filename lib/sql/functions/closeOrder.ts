"use server"

import { db } from "../database";
import { Order } from "@/lib/types";

// Function to close an order
export async function closeOrder(params: {
  tenantId: string;
  orderId: Order['id'];
}): Promise<Order> {
  return await db
    .updateTable('orders')
    .set({ closed: new Date() })
    .where('id', '=', params.orderId)
    .where('tenant_id', '=', params.tenantId)
    .returningAll()
    .executeTakeFirstOrThrow()
}