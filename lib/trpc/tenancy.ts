import { parseUserRole, type UserRole } from "@/lib/auth/roles";
import { TRPCError } from "@trpc/server";
import type { SessionPayload } from "@/lib/auth/session";

export function requireTenantId(session: SessionPayload | null): string {
  const tenantId = session?.tenant_id;
  if (!tenantId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return tenantId;
}

export function requireRole(
  session: SessionPayload | null,
  allowed: UserRole[]
): UserRole {
  const role = parseUserRole(session?.role);
  if (!role || !allowed.includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return role;
}
