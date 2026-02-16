import { db } from "../database";

export type UserRole = "admin" | "manager" | "staff";

export interface UserRecord {
  id: string;
  tenant_id: string;
  username: string;
  role: UserRole;
  password_hash: string;
  password_salt: string;
  permissions: string[];
}

export async function createUser(params: {
  tenantId: string;
  username: string;
  role: UserRole;
  passwordHash: string;
  passwordSalt: string;
  permissions?: string[];
}): Promise<UserRecord> {
  const row = await db
    .insertInto("users")
    .values({
      tenant_id: params.tenantId,
      username: params.username,
      role: params.role,
      password_hash: params.passwordHash,
      password_salt: params.passwordSalt,
      permissions: params.permissions ?? [],
    })
    .returning([
      "id",
      "tenant_id",
      "username",
      "role",
      "password_hash",
      "password_salt",
      "permissions",
    ])
    .executeTakeFirstOrThrow();

  return {
    ...row,
    permissions: row.permissions ?? [],
  };
}

export async function getUserForLogin(params: {
  username: string;
  tenantName?: string | null;
}): Promise<(UserRecord & { tenant_name: string }) | null> {
  let query = db
    .selectFrom("users")
    .innerJoin("tenants", "tenants.id", "users.tenant_id")
    .select([
      "users.id as id",
      "users.tenant_id as tenant_id",
      "users.username as username",
      "users.role as role",
      "users.password_hash as password_hash",
      "users.password_salt as password_salt",
      "users.permissions as permissions",
      "tenants.name as tenant_name",
    ])
    .where("users.username", "=", params.username);

  if (params.tenantName) {
    query = query.where("tenants.name", "=", params.tenantName);
  }

  const row = await query.executeTakeFirst();
  if (!row) return null;
  return {
    ...row,
    permissions: row.permissions ?? [],
  };
}

export async function listStaffByTenant(params: {
  tenantId: string;
}): Promise<Array<Pick<UserRecord, "id" | "username" | "permissions">>> {
  const rows = await db
    .selectFrom("users")
    .select(["id", "username", "permissions"])
    .where("tenant_id", "=", params.tenantId)
    .where("role", "=", "staff")
    .orderBy("username", "asc")
    .execute();

  return rows.map((row) => ({
    ...row,
    permissions: row.permissions ?? [],
  }));
}

export async function updateUserPermissions(params: {
  tenantId: string;
  userId: string;
  permissions: string[];
}): Promise<{ id: string; permissions: string[] }> {
  const row = await db
    .updateTable("users")
    .set({ permissions: params.permissions })
    .where("id", "=", params.userId)
    .where("tenant_id", "=", params.tenantId)
    .returning(["id", "permissions"])
    .executeTakeFirstOrThrow();

  return {
    id: row.id,
    permissions: row.permissions ?? [],
  };
}
