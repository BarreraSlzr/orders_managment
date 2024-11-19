import { OrderItem } from "@/lib/types";
import { db } from "../database";

export async function getOrderItemsDetailed(orderId: string): Promise<OrderItem[]> {
    return await db
      .selectFrom('order_items')
      .innerJoin('products', 'products.id', 'order_items.product_id')
      .select([
        'order_items.id as id',
        'order_items.product_id as product_id',
        'order_items.quantity as quantity',
        'products.name as productName',
        'products.price as price',
      ])
      .where('order_items.order_id', '=', orderId)
      .execute();
  }