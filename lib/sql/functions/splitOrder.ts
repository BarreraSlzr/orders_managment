import { OrderItemTable } from "@/lib/types";
import { db } from "../database";
import { getOrder } from "./getOrder";
import { insertOrder } from "./insertOrder";
import { getOrderItemsView } from "./getOrderItemsView";

interface SplitOrderParams {
  tenantId: string;
  oldOrderId: string;
  itemIds: OrderItemTable['id'][];
}

export async function splitOrder(params: SplitOrderParams) {
  const newOrder = await insertOrder({
    tenantId: params.tenantId,
    timeZone: "America/Mexico_City",
  });

  // Process updates for each product_id with controlled quantities
  await db
    .updateTable('order_items')
    .set({ order_id: newOrder.id })
    .where('id', 'in', params.itemIds)
    .where('tenant_id', '=', params.tenantId)
    .execute();

  return { 
    newOrder: await getOrderItemsView({
      tenantId: params.tenantId,
      orderId: newOrder.id,
    }),
    oldOrder: await getOrder({
      tenantId: params.tenantId,
      id: params.oldOrderId,
    }),
  };
}