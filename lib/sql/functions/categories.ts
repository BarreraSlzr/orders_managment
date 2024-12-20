import { Selectable } from "kysely";
import { db } from "../database";
import { CategoriesTable } from "../types";

export async function upsertCategory(name: string, id?: string): Promise<Selectable<CategoriesTable>> {
  if (id) {
    return await db
      .updateTable('categories')
      .set({ name })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
  } else {
    const [newCategory] = await db
      .insertInto('categories')
      .values({ name })
      .returningAll()
      .execute();
    return newCategory;
  }
}

export async function deleteCategory(id: string): Promise<{ deleted: string[] }> {
  const result = await db
    .deleteFrom('categories')
    .where('id', '=', id)
    .executeTakeFirst();

  if (result.numDeletedRows > 0) {
    return { deleted: [id] };
  } else {
    throw new Error(`Category with id ${id} not found`);
  }
}

export async function toggleCategoryItem(categoryId: string, itemId: string) {
  const existing = await db
    .selectFrom('category_inventory_item')
    .select(['category_id', 'item_id'])
    .where('category_id', '=', categoryId)
    .where('item_id', '=', itemId)
    .executeTakeFirst();

  if (existing) {
    await db
      .deleteFrom('category_inventory_item')
      .where('category_id', '=', categoryId)
      .where('item_id', '=', itemId)
      .execute();
    return `Removed`;
  } else {
    await db
      .insertInto('category_inventory_item')
      .values({ category_id: categoryId, item_id: itemId })
      .execute();
    return `Added`;
  }
}

export async function getCategories() {
  return await db
    .selectFrom('categories')
    .selectAll()
    .execute()
}