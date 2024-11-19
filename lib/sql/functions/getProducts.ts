import { Selectable } from "kysely"
import { Database } from "../types"
import { db } from "../database"

// Function to get products based on search and tags
export async function getProducts(search: string = '', tags: string[] = []): Promise<Selectable<Database['products']>[]> {
    let query = db.selectFrom('products')

    if (!!search) {
        query = query.where('name', 'ilike', `%${search}%`)
    }

    if (tags.length > 0) {
        query = query.where((eb) => eb.or(
            tags.map(
                tag => eb('tags', '@>', [tag])
            )
        ))
    }

    return await query.selectAll().execute()
}