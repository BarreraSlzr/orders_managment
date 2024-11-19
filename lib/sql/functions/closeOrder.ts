"use server"

import { Selectable } from "kysely";
import { Database } from "../types";
import { db } from "../database";
import { Order } from "@/lib/types";

// Function to close an order
export async function closeOrder(orderId: Order['id']): Promise<Order> {
    return await db
      .updateTable('orders')
      .set({ closed: new Date() })
      .where('id', '=', orderId)
      .returningAll()
      .executeTakeFirstOrThrow()
  }