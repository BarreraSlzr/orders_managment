"use server"

import { db } from "../database"
import { Order } from "@/lib/types"

// Function to get orders not closed on the current day
export async function getOrder(params: {
  tenantId: string;
  id: string;
}): Promise<Order> {
  return await db
    .selectFrom('orders')
    .where('id', '=', params.id)
    .where('tenant_id', '=', params.tenantId)
    .selectAll()
    .executeTakeFirstOrThrow()
}