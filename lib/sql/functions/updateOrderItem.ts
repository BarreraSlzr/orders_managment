import { Selectable } from "kysely";
import { db } from "../database";
import { Database } from "../types";

// Function to add an item to an order
export async function updateOrderItem(orderId: string, productId: string, quantity: number): Promise<Selectable<Database['order_items']> | null> {
    return await db.transaction().execute(async (trx) => {
      if (quantity === 0) {
        // Delete the order item if quantity is zero
        await trx
          .deleteFrom('order_items')
          .where('order_id', '=', orderId)
          .where('product_id', '=', productId)
          .execute()
        return null
      } else {
        // Upsert the order item
        const result = await trx
          .insertInto('order_items')
          .values({
            order_id: orderId,
            product_id: productId,
            quantity: quantity
          })
          .onConflict((oc) => oc
            .columns(['order_id', 'product_id'])
            .doUpdateSet({ quantity: quantity })
          )
          .returningAll()
          .executeTakeFirstOrThrow()
  
        return result
      }
    })
  }