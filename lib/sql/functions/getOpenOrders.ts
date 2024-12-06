"use server"

import { db, sql } from "../database"
import { Order } from "@/lib/types"

// Function to get orders not closed on the current day
export async function getOpenOrders(timeZone: string): Promise<Order[]> {
  const todayStart = sql`timezone(${timeZone}, now())::date`; // Start of the day in client timezone
  
  return await db
    .selectFrom('orders')
    .where(
      sql`timezone(${timeZone}, "created")`, 
      '>=', 
      todayStart
    )
    .where('closed', 'is', null)
    .selectAll()
    .execute()
}

export async function getOrders(): Promise<Order[]> {
  return await db
    .selectFrom('orders')
    .limit(100)
    .selectAll()
    .orderBy('created desc')
    .execute()
}