"use server";

import { db, sql } from "../database";
import { OrdersQuery, Order } from "@/lib/types";

// Utility to calculate the start and end of the given date in the specified timezone
const calculateDateRange = (timeZone: string, date?: string) => {
  if (date) {
    const start = sql`DATE_TRUNC('day', timezone(${timeZone}, ${date}::timestamp) + interval '1 second)'`;
    const end = sql`DATE_TRUNC('day', timezone(${timeZone}, ${date}::timestamp)) + interval '1 day'`;
    return { start, end };
  }

  // Default to today
  const todayStart = sql`timezone(${timeZone}, now())::date`;
  const todayEnd = sql`timezone(${timeZone}, now() + interval '1 day')::date`;
  return { start: todayStart, end: todayEnd};
};

export async function getOrders({
  timeZone = "America/Mexico_City",
  date,
  isClosed,
  all
}: OrdersQuery = {}): Promise<Order[]> {
  const { start, end } = calculateDateRange(timeZone, date);

  let query = db
    .selectFrom("orders");

  if(!all || !!date){
    query = query
    .where(eb => eb.and([
      eb(sql`timezone(${timeZone}, "created")`, ">=", start),
      eb(sql`timezone(${timeZone}, "created")`, "<=", end)
    ]));
  }

  if (isClosed !== undefined) {
    query = query.where("closed", isClosed ? "is not" : "is", null);
  }

  return await query.selectAll().orderBy("created", "desc").execute();
}
