import { Selectable } from "kysely";
import { db } from "../database";
import { CategoriesTable } from "../types";

export async function upsertCategory(params: {
  tenantId: string;
  name: string;
  id?: string;
}): Promise<Selectable<CategoriesTable>> {
  if (params.id) {
    return await db
      .updateTable('categories')
      .set({ name: params.name })
      .where('id', '=', params.id)
      .where('tenant_id', '=', params.tenantId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  const [newCategory] = await db
    .insertInto('categories')
    .values({ name: params.name, tenant_id: params.tenantId })
    .returningAll()
    .execute();
  return newCategory;
}

export async function deleteCategory(params: {
  tenantId: string;
  id: string;
}): Promise<{ deleted: string[] }> {
  const result = await db
    .deleteFrom('categories')
    .where('id', '=', params.id)
    .where('tenant_id', '=', params.tenantId)
    .executeTakeFirst();

  if (result.numDeletedRows > 0) {
    return { deleted: [params.id] };
  } else {
    throw new Error(`Category with id ${params.id} not found`);
  }
}

export async function toggleCategoryItem(params: {
  tenantId: string;
  categoryId: string;
  itemId: string;
}) {
  const existing = await db
    .selectFrom('category_inventory_item')
    .select(['category_id', 'item_id'])
    .where('category_id', '=', params.categoryId)
    .where('item_id', '=', params.itemId)
    .where('tenant_id', '=', params.tenantId)
    .executeTakeFirst();

  if (existing) {
    await db
      .deleteFrom('category_inventory_item')
      .where('category_id', '=', params.categoryId)
      .where('item_id', '=', params.itemId)
      .where('tenant_id', '=', params.tenantId)
      .execute();
    return `Removed`;
  } else {
    await db
      .insertInto('category_inventory_item')
      .values({
        category_id: params.categoryId,
        item_id: params.itemId,
        tenant_id: params.tenantId,
      })
      .execute();
    return `Added`;
  }
}

export async function getCategories(params: { tenantId: string }) {
  return await db
    .selectFrom('categories')
    .selectAll()
    .where('tenant_id', '=', params.tenantId)
    .execute()
}