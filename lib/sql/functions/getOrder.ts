import { Selectable } from "kysely"
import { Database } from "../types"
import { db } from "../database"

// Function to get orders not closed on the current day
export async function getOrder(id: string): Promise<Selectable<Database['orders']>> {
    return await db
      .selectFrom('orders')
      .where('id', 'like', id)
      .selectAll()
      .executeTakeFirstOrThrow()
}