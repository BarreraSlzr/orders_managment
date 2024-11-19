"use server"

import { Selectable } from "kysely";
import { Database } from "../types";
import { db } from "../database";
import { Order } from "@/lib/types";

export async function addOrder(position: Order['position']): Promise<Order> {
    return await db
      .insertInto('orders')
      .values({
        position
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }