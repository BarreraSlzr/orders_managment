"use server"

import { Order, OrderItem } from "@/lib/types";
import { db } from "../database";
import { CompiledQuery } from "kysely";

export async function getOrderItemsDetailed(orderId: Order['id']): Promise<OrderItem[]> {
  const sqlQuery = `
    SELECT
      p.id AS product_id,
      p.name,
      p.price,
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'id', oi.id,
          'is_takeaway', oi.is_takeaway,
          'payment_option_id', oi.payment_option_id
        )
      ) AS items
    FROM
      order_items oi
    INNER JOIN
      products p
      ON oi.product_id = p.id
    WHERE
      oi.order_id = $1
    GROUP BY
      p.id, p.name, p.price
  `;
  const results = await db.executeQuery<OrderItem>(CompiledQuery.raw(sqlQuery, [orderId]));
  
  return results.rows
}

