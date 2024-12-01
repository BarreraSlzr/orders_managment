import { OrderItem } from "@/lib/types";
import { db } from "../database";
import { getOrder } from "./getOrder";
import { getOrderItemsDetailed } from "./getOrderItemsDetailed";
import { insertOrder } from "./insertOrder";

interface props {
  orderId: string, 
  productIds: string[]
} 

export async function splitOrder({
    orderId,
    productIds
}: props) {
  const newOrder = await insertOrder("America/Mexico_City");
  // Count occurrences of each product_id
  const productCounts = productIds.reduce<Record<string, number>>((counts, id) => {
    counts[id] = (counts[id] || 0) + 1;
    return counts;
  }, {});

  // Process updates for each product_id with controlled quantities
  for (const [productId, quantity] of Object.entries(productCounts)) {
    const itemsToUpdate = await db
      .selectFrom('order_items')
      .where('product_id', '=', productId)
      .where('order_id', '=', orderId)
      .limit(quantity) // Limit the update to the required quantity
      .selectAll()
      .execute();

    // Update each selected item to the new order ID
    for (const item of itemsToUpdate) {
      await db
        .updateTable('order_items')
        .set({ order_id: newOrder.id })
        .where('id', '=', item.id) // Ensure a specific row is updated
        .returningAll()
        .executeTakeFirstOrThrow();
    }
  }

  return {newOrder: await getOrder(newOrder.id), olderOrder: await getOrder(orderId), items: await getOrderItemsDetailed(newOrder.id)};
}