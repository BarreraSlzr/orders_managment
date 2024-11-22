"use server"

import { Selectable } from "kysely"
import { Database } from "../types"
import { db } from "../database"
import { Order } from "@/lib/types"

// Function to get orders not closed on the current day
export async function getOrder(id: string): Promise<Order> {
    return await db
      .selectFrom('orders')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirstOrThrow()
}