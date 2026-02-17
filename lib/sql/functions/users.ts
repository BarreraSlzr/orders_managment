import { db, sql } from "../database";

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
  const permissions = params.permissions ?? [];
  const row = await db
    .insertInto("users")
    .values({
      tenant_id: params.tenantId,
      username: params.username,
      role: params.role,
      password_hash: params.passwordHash,
      password_salt: params.passwordSalt,
      permissions: sql`${JSON.stringify(permissions)}::jsonb`,
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

export async function listUsersByTenant(params: {
  tenantId: string;
  roles: UserRole[];
}): Promise<
  Array<Pick<UserRecord, "id" | "username" | "role" | "permissions">>
> {
  const rows = await db
    .selectFrom("users")
    .select(["id", "username", "role", "permissions"])
    .where("tenant_id", "=", params.tenantId)
    .where("role", "in", params.roles)
    .orderBy("role", "asc")
    .orderBy("username", "asc")
    .execute();

  return rows.map((row) => ({
    ...row,
    permissions: row.permissions ?? [],
  }));
}

export async function listUsersByTenants(params: {
  tenantIds: string[];
  roles: UserRole[];
}): Promise<
  Array<
    Pick<UserRecord, "id" | "username" | "role" | "permissions" | "tenant_id"> & {
      tenant_name: string;
    }
  >
> {
  if (params.tenantIds.length === 0) {
    return [];
  }

  const rows = await db
    .selectFrom("users")
    .innerJoin("tenants", "tenants.id", "users.tenant_id")
    .select([
      "users.id as id",
      "users.username as username",
      "users.role as role",
      "users.permissions as permissions",
      "users.tenant_id as tenant_id",
      "tenants.name as tenant_name",
    ])
    .where("users.tenant_id", "in", params.tenantIds)
    .where("users.role", "in", params.roles)
    .orderBy("tenants.name", "asc")
    .orderBy("users.role", "asc")
    .orderBy("users.username", "asc")
    .execute();

  return rows.map((row) => ({
    ...row,
    permissions: row.permissions ?? [],
  }));
}

export async function getUserWithTenantById(params: {
  userId: string;
}): Promise<(UserRecord & { tenant_name: string }) | null> {
  const row = await db
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
    .where("users.id", "=", params.userId)
    .executeTakeFirst();

  if (!row) return null;

  return {
    ...row,
    permissions: row.permissions ?? [],
  };
}

export async function updateUserProfile(params: {
  userId: string;
  tenantId?: string;
  username?: string;
  passwordHash?: string;
  passwordSalt?: string;
  permissions?: string[];
}): Promise<Pick<UserRecord, "id" | "username" | "role" | "permissions">> {
  const updates: Record<string, unknown> = {};

  if (typeof params.username === "string" && params.username.trim()) {
    updates.username = params.username.trim();
  }

  if (params.passwordHash && params.passwordSalt) {
    updates.password_hash = params.passwordHash;
    updates.password_salt = params.passwordSalt;
  }

  if (params.permissions) {
    updates.permissions = sql`${JSON.stringify(params.permissions)}::jsonb`;
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("No updates provided");
  }

  let query = db.updateTable("users").set(updates).where("id", "=", params.userId);
  if (params.tenantId) {
    query = query.where("tenant_id", "=", params.tenantId);
  }

  const row = await query
    .returning(["id", "username", "role", "permissions"])
    .executeTakeFirstOrThrow();

  return {
    ...row,
    permissions: row.permissions ?? [],
  };
}

export async function updateUserPermissions(params: {
  tenantId: string;
  userId: string;
  permissions: string[];
}): Promise<{ id: string; permissions: string[] }> {
  const row = await db
    .updateTable("users")
    .set({ permissions: sql`${JSON.stringify(params.permissions)}::jsonb` })
    .where("id", "=", params.userId)
    .where("tenant_id", "=", params.tenantId)
    .returning(["id", "permissions"])
    .executeTakeFirstOrThrow();

  return {
    id: row.id,
    permissions: row.permissions ?? [],
  };
}
