"use server"

import { Selectable } from "kysely"
import { Database } from "../types"
import { db } from "../database"
import { Order } from "@/lib/types"

// Function to get orders not closed on the current day
export async function getOpenOrders(): Promise<Order[]> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
  
    return await db
      .selectFrom('orders')
      .where('created', '>=', today)
      .where('closed', 'is', null)
      .selectAll()
      .execute()
  }