"use server";

import { sql } from "kysely";
import { db } from "../database";

export async function getProductConsumptions(params: {
  tenantId: string;
  productId: string;
}) {
  return await db
    .selectFrom("product_consumptions as pc")
    .innerJoin("inventory_items as ii", "ii.id", "pc.item_id")
    .select([
      "pc.id",
      "pc.product_id",
      "pc.item_id",
      "pc.quantity",
      "pc.quantity_type_value",
      "pc.is_takeaway",
      "ii.name as item_name",
      "ii.quantity_type_key",
      // Net stock: IN minus OUT for quick availability dot
      sql<number>`coalesce((
        select sum(case when type = 'IN' then quantity else -quantity end)
        from transactions t
        where t.item_id = pc.item_id
          and t.tenant_id = ${params.tenantId}
      ), 0)`.as('stock'),
    ])
    .where("pc.tenant_id", "=", params.tenantId)
    .where("pc.product_id", "=", params.productId)
    .where("pc.deleted", "is", null)
    .execute();
}

export async function addProductConsumption(params: {
  tenantId: string;
  productId: string;
  itemId: string;
  quantity: number;
  quantityTypeValue: string;
  isTakeaway?: boolean;
}) {
  return await db
    .insertInto("product_consumptions")
    .values({
      tenant_id: params.tenantId,
      product_id: params.productId,
      item_id: params.itemId,
      quantity: params.quantity,
      quantity_type_value: params.quantityTypeValue,
      is_takeaway: params.isTakeaway ?? false,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function removeProductConsumption(params: {
  tenantId: string;
  id: string;
}) {
  return await db
    .updateTable("product_consumptions")
    .set({ deleted: new Date() })
    .where("id", "=", params.id)
    .where("tenant_id", "=", params.tenantId)
    .returningAll()
    .executeTakeFirstOrThrow();
}
