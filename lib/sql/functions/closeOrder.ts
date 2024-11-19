import { Selectable } from "kysely";
import { Database } from "../types";
import { db } from "../database";

// Function to close an order
export async function closeOrder(orderId: number): Promise<Selectable<Database['orders']>> {
    return await db
      .updateTable('orders')
      .set({ closed: new Date() })
      .where('id', '=', orderId)
      .returningAll()
      .executeTakeFirstOrThrow()
  }