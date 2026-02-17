import { db } from "@/lib/sql/database";

export interface CreateAdminAuditLogParams {
  action: string;
  adminId: string;
  role?: string;
  tenantId?: string;
  targetTenantId?: string;
  metadata?: Record<string, unknown> | null;
}

export async function createAdminAuditLog(
  params: CreateAdminAuditLogParams
): Promise<{ id: number }> {
  const record = await db
    .insertInto("admin_audit_logs")
    .values({
      action: params.action,
      admin_id: params.adminId,
      role: params.role ?? null,
      tenant_id: params.tenantId ?? null,
      target_tenant_id: params.targetTenantId ?? null,
      metadata: params.metadata ?? null,
    })
    .returning(["id"])
    .executeTakeFirstOrThrow();

  return { id: record.id };
}

export interface ListAdminAuditLogsParams {
  limit?: number;
  offset?: number;
  adminId?: string;
  action?: string;
  targetTenantId?: string;
}

export async function listAdminAuditLogs(params: ListAdminAuditLogsParams) {
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  let query = db
    .selectFrom("admin_audit_logs")
    .leftJoin("users", "users.id", "admin_audit_logs.admin_id")
    .leftJoin(
      "tenants as admin_tenants",
      "admin_tenants.id",
      "admin_audit_logs.tenant_id"
    )
    .leftJoin(
      "tenants as target_tenants",
      "target_tenants.id",
      "admin_audit_logs.target_tenant_id"
    )
    .select([
      "admin_audit_logs.id as id",
      "admin_audit_logs.action as action",
      "admin_audit_logs.role as role",
      "admin_audit_logs.created as created",
      "admin_audit_logs.admin_id as admin_id",
      "users.username as admin_username",
      "admin_audit_logs.tenant_id as tenant_id",
      "admin_tenants.name as tenant_name",
      "admin_audit_logs.target_tenant_id as target_tenant_id",
      "target_tenants.name as target_tenant_name",
      "admin_audit_logs.metadata as metadata",
    ]);

  if (params.adminId) {
    query = query.where("admin_audit_logs.admin_id", "=", params.adminId);
  }

  if (params.action) {
    query = query.where("admin_audit_logs.action", "=", params.action);
  }

  if (params.targetTenantId) {
    query = query.where(
      "admin_audit_logs.target_tenant_id",
      "=",
      params.targetTenantId
    );
  }

  return query
    .orderBy("admin_audit_logs.created", "desc")
    .limit(limit)
    .offset(offset)
    .execute();
}
