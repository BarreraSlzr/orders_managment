import { db } from "../database";

export async function createTenant(params: { name: string }): Promise<{
  id: string;
  name: string;
}> {
  return db
    .insertInto("tenants")
    .values({ name: params.name })
    .onConflict((oc) => oc.column("name").doUpdateSet({ name: params.name }))
    .returning(["id", "name"])
    .executeTakeFirstOrThrow();
}

export async function getTenantByName(params: { name: string }): Promise<{
  id: string;
  name: string;
} | null> {
  const row = await db
    .selectFrom("tenants")
    .select(["id", "name"])
    .where("name", "=", params.name)
    .executeTakeFirst();
  return row ?? null;
}
