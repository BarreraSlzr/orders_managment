import { Selectable } from "kysely";
import { Database } from "../types";
import { db } from "../database";

export async function addOrder(position: number): Promise<Selectable<Database['orders']>> {
    return await db
      .insertInto('orders')
      .values({
        position
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }