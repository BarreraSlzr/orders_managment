"use server"

import { Order, OrderItem } from "@/lib/types";
import { db } from "../database";
import { CompiledQuery } from "kysely";

export async function getOrderItemsDetailed(orderId: Order['id']): Promise<OrderItem[]> {
  const sqlQuery = `
    SELECT
      p.id AS product_id,
      p.name AS productName,
      p.price AS productPrice,
      COUNT(oi.product_id) AS quantity
    FROM
      order_items oi
    INNER JOIN
      product p
      ON oi.product_id = p.id
    WHERE
      oi.order_id = $1
    GROUP BY
      p.id, p.name, p.price
  `;
  const results = await db.executeQuery<OrderItem>(CompiledQuery.raw(sqlQuery,[orderId]));

  return results.rows.map((row) => ({
    product_id: row.product_id,
    quantity: Number(row.quantity), // Ensure quantity is a number
    productName: row.productName,
    productPrice: row.productPrice,
  }));
}
