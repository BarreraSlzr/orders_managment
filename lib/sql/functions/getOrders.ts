"use server";

import { db, sql } from "../database";
import { OrdersQuery, Order } from "@/lib/types";

// Utility to calculate the start and end of the given date in the specified timezone
const calculateDateRange = (timeZone: string, date?: string) => {
  if (date) {
    const start = sql`DATE_TRUNC('day', timezone(${timeZone}, ${date}::timestamptz)) + interval '1 day'`;
    const end = sql`DATE_TRUNC('day', timezone(${timeZone}, ${date}::timestamptz)) + interval '2 day'`;
    return { start, end };
  }

  // Default to today
  const todayStart = sql`timezone(${timeZone}, now())::date`;
  const todayEnd = sql`timezone(${timeZone}, now() + interval '1 day')::date`;
  return { start: todayStart, end: todayEnd };
};

export async function getOrders({
  timeZone = "America/Mexico_City",
  date,
  status = '',
}: OrdersQuery = {}): Promise<Order[]> {
  const { start, end } = calculateDateRange(timeZone, date);

  let query = db
    .selectFrom("orders");

  if (status !== '' || !!date) {
    query = query
      .where(sql`timezone(${timeZone}, "created")`, ">=", start)
      .where(sql`timezone(${timeZone}, "created")`, "<=", end)
  }

  if (status === 'opened') {
    query = query.where("closed", "is", null);
  } else if (status === 'closed') {
    query = query.where("closed", "is not", null);
  }

  return await query.selectAll().orderBy("created", "desc").execute();
}
