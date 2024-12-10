import { CompiledQuery } from 'kysely';
import { db } from '../database';
import { OrderItem, OrderItemsView } from '../types';
import { getOrder } from './getOrder';

// Define a function to get the OrderItemsView by orderId
export async function getOrderItemsView(orderId: string): Promise<OrderItemsView> {
  // Step 1: Aggregate the order items for the given orderId (but not nested json_agg)
  const orderItems = await db.executeQuery<OrderItem>(CompiledQuery.raw(`
    SELECT
      order_items.order_id,
      order_items.product_id,
      products.name,
      products.price,
      json_agg(
        json_build_object(
          'id', order_items.id,
          'is_takeaway', order_items.is_takeaway,
          'payment_option_id', order_items.payment_option_id
        )
      ) AS items
    FROM
      order_items
    JOIN products ON products.id = order_items.product_id
    WHERE
      order_items.order_id = $1
    GROUP BY
      products.name,
      products.price,
      order_items.order_id,
      order_items.product_id;
    `, [orderId]));

  // Step 2: Group the aggregated items by product_id
  const groupedItems = orderItems.rows.reduce((acc, item) => {
    const productId = item.product_id;
    if (!acc.has(productId)) {
      acc.set(productId, {
        product_id: productId,
        name: item.name,
        price: item.price,
        items: [],
      });
    }
    acc.get(productId).items.push(...item.items);
    return acc;
  }, new Map<string, any>());

  //Fetch the order details for the given orderId
  const order = await getOrder(orderId);

  //Return the final structured data
  return {
    id: order.id,
    created: order.created,
    deleted: order.deleted,
    updated: order.updated,
    closed: order.closed,
    position: order.position,
    total: order.total,
    products: Array.from(groupedItems.values()), // Attach the aggregated items
  };
}
