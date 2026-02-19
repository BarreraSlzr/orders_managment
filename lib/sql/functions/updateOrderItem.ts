"use server"

import { db } from "../database";
import { OrderItemTable } from "@/lib/types";

export async function updateOrderItem(params: {
  tenantId: string;
  orderId: string;
  productId: string;
  type: 'INSERT' | 'DELETE';
  // Admin defaults (applied lazily from client context)
  defaultPaymentOptionId?: number;
  defaultIsTakeaway?: boolean;
}): Promise<OrderItemTable | null> {
  if (params.type === 'DELETE') {
    // Perform DELETE operation
    await db
      .deleteFrom('order_items')
      .where('id', '=', eb => eb
        .selectFrom('order_items')
        .select('id')
        .limit(1) // Deletes only one matching item
        .where('order_id', '=', params.orderId)
        .where('product_id', '=', params.productId)
        .where('tenant_id', '=', params.tenantId)
        )
      .where('tenant_id', '=', params.tenantId)
      .execute();
    return null;
  } else if (params.type === 'INSERT') {
    // Perform INSERT operation with admin defaults
    const result = await db
      .insertInto('order_items')
      .values({
        tenant_id: params.tenantId,
        order_id: params.orderId,
        product_id: params.productId,
        // Apply admin defaults, fallback to hardcoded defaults if not provided
        payment_option_id: params.defaultPaymentOptionId ?? 3,
        is_takeaway: params.defaultIsTakeaway ?? false,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return result;
  }

  throw new Error(`Unexpected type: ${params.type}`);
}