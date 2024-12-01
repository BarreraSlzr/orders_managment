import { db } from '@/lib/sql/database';
import { Product } from '@/lib/types';
import { InsertObject, UpdateType } from 'kysely';
import { Database } from '../types';

type Insert = InsertObject<Database, 'products'>
type Update = UpdateType<Product> & { id: string }
export async function upsertProduct(product: Update | Insert): Promise<Product> {
  if (!!product.id) {
    const { id = '', name, price, tags } = (product as Update);
    // Update existing product
    return await db
      .updateTable('products')
      .set({ name, price, tags })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
  } else {
    const { name, price, tags } = (product as Insert);
    // Insert new product
    return await db
      .insertInto('products')
      .values({ name, price, tags })
      .returningAll()
      .executeTakeFirstOrThrow();
  }
}
