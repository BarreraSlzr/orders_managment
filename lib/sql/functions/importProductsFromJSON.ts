"use server"

import { db } from '../database';
import productsSeed from '@/lib/sql/productsSeed.json'
import { CompiledQuery } from 'kysely';

const sqlSeedProductsFromJSON = `
-- Define your JSON data
DO $$
DECLARE
    json_data jsonb := '${JSON.stringify({
    Products: productsSeed.Products.map((v) => ({
        name: v.Producto,
        price: parseInt(v.Precio.replace('$', '').trim()) * 100,
        tags: v.Tags.split(',').map(t => t.trim()).join(',')
    }))
})}';
product jsonb; -- Declare a variable to hold each JSON object
BEGIN
    -- Loop through each product in the JSON array
    FOR product IN SELECT * FROM jsonb_array_elements(json_data->'Products')
    LOOP
        -- Insert data into the products table
        INSERT INTO products (name, price, tags)
        VALUES (
            product->>'name',
            NULLIF(product->>'price', '')::int,
            REPLACE(product->>'tags', ', ', ','),
        );
    END LOOP;
END $$;
`

export async function importProductsFromJson(): Promise<void> {
    try {
        if( (await db.executeQuery<{count: number}>(CompiledQuery.raw(`SELECT count(id) FROM products`))).rows.pop()?.count === 0){
            await db.executeQuery(CompiledQuery.raw(`${sqlSeedProductsFromJSON}`, []));
            console.info(`Table "products" populated`)
        }
    } catch (error) {
        console.error('Error importing products:', error);
    }
}