"use server"

import fs from 'fs/promises';
import { db } from '../database';
import productsSeed from '@/lib/sql/productsSeed.json'

export async function importProductsFromJson(): Promise<void> {
    try {
        // Read and parse the JSON file
        const jsonData = productsSeed;

        if (!jsonData.Products || !Array.isArray(jsonData.Products)) {
            throw new Error('Invalid JSON structure: Expected a "Products" array.');
        }

        // Process and insert each product
        for await(const product of jsonData.Products) {
            const { Producto, Precio, Tags } = product;

            if (!Producto || !Precio || !Tags) {
                console.warn('Skipping invalid product:', product);
                continue;
            }

            // Convert price from string to integer (assuming it's in the format "$123")
            const priceInCents = parseInt(Precio.replace('$', '').trim()) * 100;

            await db
                .insertInto('products')
                .values({
                    name: Producto,
                    price: priceInCents,
                    tags: Tags.split(',').map(v => v.trim()),
                })
                .execute()
                .then(() =>
                  console.info(`Insert "${Producto}"`)
                );
        }

        console.log('Products imported successfully!');
    } catch (error) {
        console.error('Error importing products:', error);
    }
}