import { OrderItemTable } from "@/lib/types";
import { db } from "../database";
import { getOrder } from "./getOrder";
import { getOrderItemsDetailed } from "./getOrderItemsDetailed";
import { insertOrder } from "./insertOrder";

interface props {
  old_order_id: string,
  item_ids: OrderItemTable['id'][]
}

export async function splitOrder({
  old_order_id, 
  item_ids
}: props) {
  const newOrder = await insertOrder("America/Mexico_City");

  // Process updates for each product_id with controlled quantities
  await db
    .updateTable('order_items')
    .set({ order_id: newOrder.id })
    .where('id', 'in', item_ids)
    .execute();

  return { 
    newOrder: await getOrder(newOrder.id),
    oldOrder: await getOrder(old_order_id),
    items: await getOrderItemsDetailed(newOrder.id) 
  };
}