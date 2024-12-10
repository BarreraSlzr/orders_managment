import { OrderItemTable } from "@/lib/types";
import { db } from "../database";
import { getOrder } from "./getOrder";
import { insertOrder } from "./insertOrder";
import { getOrderItemsView } from "./getOrderItemsView";

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
    newOrder: await getOrderItemsView(newOrder.id),
    oldOrder: await getOrder(old_order_id),
  };
}