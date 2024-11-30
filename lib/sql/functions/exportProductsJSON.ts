import { CompiledQuery, JSONColumnType, JSONReferenceNode } from "kysely"
import { db } from "../database"

const sql =`SELECT json_agg(
    json_build_object(
        'name', name,
        'price', price,
        'tags', tags
    )
ORDER BY tags ASC
) AS json_result
FROM products;
`;

export async function exportProductsJSON() {
    try {
        return await db.executeQuery<string>(CompiledQuery.raw(`${sql}`, []));
        console.info(`Table "products" populated`)
    } catch (error) {
        console.error('Error importing products:', error);
    }
}

