"use server"

import { sql } from "kysely"
import { db } from "../database";

const selectUniqueTags = `
SELECT DISTINCT unnest(tags) AS tag
FROM products;
`

interface Tag {
  tag: string
}

export async function getUniqueTags() {
  const result = await sql`${selectUniqueTags}`.execute(db)
  return result.rows as Tag[];
}

/* 
export async function getTags(): Promise<string[]> {
    const tags = await db
      .selectFrom('products')
      .select(db.fn.agg('array_agg','tags').as('all_tags'))
      .executeTakeFirstOrThrow()
  
    // Flatten the array of arrays and remove duplicates
    return Array.from(new Set(tags.all_tags.flat()))
  } */