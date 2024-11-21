"use server"

import { db } from "../database"
import { Product } from "@/lib/types"

// Function to get products based on search and tags
export async function getProducts(search: string = '', tags: string[] = []): Promise<Product[]> {
    let query = db.selectFrom('products')

    if (!!search) {
        query = query.where('name', 'ilike', `%${search}%`)
    }

    if (tags.length > 0) {
        query = query.where((eb) => eb.and(
            tags.map(
                tag => eb('tags', 'ilike', `%${tag}%`)
            )
        ))
    }

    return await query.selectAll().execute()
}