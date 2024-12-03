"use server"

import { db } from "../database";
import { OrderItemTable } from "@/lib/types";

export async function updateOrderItem(
  orderId: string,
  productId: string,
  type: string //'INSERT' | 'DELETE'
): Promise<OrderItemTable | null> {
  if (type === 'DELETE') {
    // Perform DELETE operation
    await db
      .deleteFrom('order_items')
      .where('id', '=', eb => eb
        .selectFrom('order_items')
        .select('id')
        .limit(1) // Deletes only one matching item
        .where('order_id', '=', orderId)
        .where('product_id', '=', productId)
        )
      .execute();
    return null;
  } else if (type === 'INSERT') {
    // Perform INSERT operation
    const result = await db
      .insertInto('order_items')
      .values({
        order_id: orderId,
        product_id: productId,
        payment_option_id: 1
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return result;
  }

  throw new Error(`Unexpected type: ${type}`);
}