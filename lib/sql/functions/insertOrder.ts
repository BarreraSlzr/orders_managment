"use server"

import { db, sql } from "../database";
import { Order } from "@/lib/types";

export async function insertOrder(params: {
  tenantId: string;
  timeZone: string;
}): Promise<Order> {
  const timeZone = params.timeZone;
  const todayStart = sql`timezone(${timeZone}, now())::date`; // Start of the day in client timezone
  const nextPositionQuery = db
    .selectFrom('orders')
    .select(sql`COALESCE(MAX(position), 0) + 1`.as('next_position'))
    .where('tenant_id', '=', params.tenantId)
    .where(
      sql`timezone(${timeZone}, "created")`, 
      '>=', 
      todayStart
    )
    .executeTakeFirstOrThrow();

  const { next_position } = await nextPositionQuery;

  return await db
    .insertInto('orders')
    .values({
      tenant_id: params.tenantId,
      position: parseInt(`${next_position ?? 0}`)
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}