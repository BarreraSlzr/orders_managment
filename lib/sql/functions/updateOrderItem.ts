"use server"

import { db } from "../database";
import { OrderItemTable } from "@/lib/types";

// Function to add an item to an order
export async function updateOrderItem(orderId: OrderItemTable['order_id'], productId: OrderItemTable['product_id'], type: string  ): Promise<OrderItemTable | null> {
  const INSERT = "INSERT";
  const DELETE = "DELETE";
  if ( ![DELETE, INSERT].some(action => action === type) ) throw new Error(`UNEXPECTED action type: ${type}`);
  
  return await db.transaction().execute(async (trx) => {
      if (type === DELETE) {
        // Delete the order item
        await trx
          .deleteFrom('order_items')
          .where('id', 'in', 
            trx.selectFrom('order_items')
            .select('id')
            .limit(1)
            .where('order_id', '=', orderId)
            .where('product_id', '=', productId)
          )
          .execute()
        return null
      } else {
        // Insert the order item
        const result = await trx
          .insertInto('order_items')
          .values({
            order_id: orderId,
            product_id: productId,
          })
          .returningAll()
          .executeTakeFirstOrThrow()
  
        return result
      }
    })
  }