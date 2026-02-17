import { generateTempPassword, hashPassword } from "@/lib/auth/passwords";
import { parseUserRole } from "@/lib/auth/roles";
import {
  createUser,
  getUserWithTenantById,
  listStaffByTenant,
  listUsersByTenant,
  listUsersByTenants,
  updateUserProfile,
  updateUserPermissions,
  type UserRole,
} from "@/lib/sql/functions/users";
import { createTenant, listTenants } from "@/lib/sql/functions/tenants";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../init";

function getTenantId(session: Record<string, unknown> | null): string {
  const tenantId =
    session && typeof session.tenant_id === "string" ? session.tenant_id : "";
  if (!tenantId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return tenantId;
}

function requireManagerRole(session: Record<string, unknown> | null): void {
  const role = parseUserRole(session?.role);
  if (role !== "manager") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

function requireSystemAdmin(session: Record<string, unknown> | null): void {
  const role = parseUserRole(session?.role);
  const tenantName =
    session && typeof session.tenant_name === "string"
      ? session.tenant_name
      : null;
  if (role !== "admin" || tenantName !== "system") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

function getSessionTenantName(session: Record<string, unknown> | null): string | null {
  return session && typeof session.tenant_name === "string"
    ? session.tenant_name
    : null;
}

function assertCanEditUser(params: {
  session: Record<string, unknown> | null;
  target: { tenant_id: string; role: UserRole };
}): { tenantId: string | null; isSystemAdmin: boolean } {
  const role = parseUserRole(params.session?.role);
  if (!role) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  const tenantId = getTenantId(params.session);
  const tenantName = getSessionTenantName(params.session);
  const isSystemAdmin = role === "admin" && tenantName === "system";
  const isManager = role === "manager";
  const isAdmin = role === "admin";
  const isTargetManager = params.target.role === "manager";
  const isTargetStaff = params.target.role === "staff";

  if (isSystemAdmin) {
    if (!isTargetManager && !isTargetStaff) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return { tenantId: null, isSystemAdmin };
  }

  if (params.target.tenant_id !== tenantId) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  if (isAdmin && (isTargetManager || isTargetStaff)) {
    return { tenantId, isSystemAdmin: false };
  }

  if (isManager && isTargetStaff) {
    return { tenantId, isSystemAdmin: false };
  }

  throw new TRPCError({ code: "FORBIDDEN" });
}

export const usersRouter = router({
  /** Current session user (for UI personalization) */
  me: protectedProcedure.query(({ ctx }) => {
    const role = parseUserRole(ctx.session?.role);
    const username =
      typeof ctx.session?.username === "string" ? ctx.session.username : null;
    if (!role || !username) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    return {
      id: ctx.session?.sub ?? "",
      username,
      role,
    };
  }),
  /** Manager view: list staff users in current tenant */
  listStaff: protectedProcedure.query(async ({ ctx }) => {
    requireManagerRole(ctx.session);
    const tenantId = getTenantId(ctx.session);
    return listStaffByTenant({ tenantId });
  }),

  /** Tenant roster: list visible users by role (admin/manager/staff) */
  listRoster: protectedProcedure.query(async ({ ctx }) => {
    const role = parseUserRole(ctx.session?.role);
    if (!role) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const tenantId = getTenantId(ctx.session);
    const visibleRoles =
      role === "admin"
        ? ["manager", "staff"]
        : role === "manager"
        ? ["manager", "staff"]
        : ["manager", "staff"];

    return listUsersByTenant({ tenantId, roles: visibleRoles });
  }),

  /** System admin: list all tenants */
  listSystemTenants: protectedProcedure.query(async ({ ctx }) => {
    requireSystemAdmin(ctx.session);
    return listTenants();
  }),

  /** System admin: list roster across tenants */
  listSystemRoster: protectedProcedure
    .input(z.object({ tenantId: z.string().min(1).optional() }).optional())
    .query(async ({ ctx, input }) => {
      requireSystemAdmin(ctx.session);
      const tenants = await listTenants();
      const targetTenants = input?.tenantId
        ? tenants.filter((tenant) => tenant.id === input.tenantId)
        : tenants;

      const tenantIds = targetTenants.map((tenant) => tenant.id);
      const rows = await listUsersByTenants({
        tenantIds,
        roles: ["manager", "staff"],
      });

      const grouped = new Map(
        targetTenants.map((tenant) => [
          tenant.id,
          { ...tenant, managers: [], staff: [] },
        ])
      );

      for (const user of rows) {
        const entry = grouped.get(user.tenant_id);
        if (!entry) continue;
        if (user.role === "manager") {
          entry.managers.push(user);
        } else {
          entry.staff.push(user);
        }
      }

      return {
        tenants: Array.from(grouped.values()),
      };
    }),

  /** Fetch a user for edit workflows */
  getEditableUser: protectedProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const user = await getUserWithTenantById({ userId: input.userId });
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      assertCanEditUser({ session: ctx.session, target: user });

      return {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions: user.permissions ?? [],
        tenant_id: user.tenant_id,
        tenant_name: user.tenant_name,
      };
    }),

  /** Update a user profile (username/password/permissions) */
  updateUserProfile: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        username: z.string().min(1).optional(),
        tempPassword: z.string().min(8).optional(),
        permissions: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getUserWithTenantById({ userId: input.userId });
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const { tenantId } = assertCanEditUser({
        session: ctx.session,
        target: user,
      });

      const updates: {
        username?: string;
        passwordHash?: string;
        passwordSalt?: string;
        permissions?: string[];
      } = {};

      if (typeof input.username === "string" && input.username.trim()) {
        updates.username = input.username.trim();
      }

      if (typeof input.tempPassword === "string" && input.tempPassword.trim()) {
        const { hash, salt } = hashPassword({ password: input.tempPassword });
        updates.passwordHash = hash;
        updates.passwordSalt = salt;
      }

      if (input.permissions) {
        updates.permissions = input.permissions;
      }

      try {
        return await updateUserProfile({
          userId: input.userId,
          tenantId: tenantId ?? undefined,
          username: updates.username,
          passwordHash: updates.passwordHash,
          passwordSalt: updates.passwordSalt,
          permissions: updates.permissions,
        });
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Invalid update",
        });
      }
    }),

  /** Manager action: update staff permissions */
  updatePermissions: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        permissions: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireManagerRole(ctx.session);
      const tenantId = getTenantId(ctx.session);
      return updateUserPermissions({
        tenantId,
        userId: input.userId,
        permissions: input.permissions,
      });
    }),

  /** Manager onboarding: create staff user within tenant */
  onboardStaff: protectedProcedure
    .input(
      z.object({
        username: z.string().min(1),
        tempPassword: z.string().min(8).optional(),
        permissions: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireManagerRole(ctx.session);
      const tenantId = getTenantId(ctx.session);
      const tempPassword = input.tempPassword ?? generateTempPassword();
      const { hash, salt } = hashPassword({ password: tempPassword });

      const user = await createUser({
        tenantId,
        username: input.username,
        role: "staff",
        passwordHash: hash,
        passwordSalt: salt,
        permissions: input.permissions,
      });

      return {
        userId: user.id,
        username: user.username,
        tempPassword,
      };
    }),

  /** System admin onboarding: create tenant + manager */
  onboardTenantManager: protectedProcedure
    .input(
      z.object({
        tenantName: z.string().min(1),
        managerUsername: z.string().min(1),
        tempPassword: z.string().min(8).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireSystemAdmin(ctx.session);
      const tenant = await createTenant({ name: input.tenantName });
      const tempPassword = input.tempPassword ?? generateTempPassword();
      const { hash, salt } = hashPassword({ password: tempPassword });

      const user = await createUser({
        tenantId: tenant.id,
        username: input.managerUsername,
        role: "manager",
        passwordHash: hash,
        passwordSalt: salt,
      });

      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        managerId: user.id,
        username: user.username,
        tempPassword,
      };
    }),

  /** System admin onboarding: create staff in a tenant */
  onboardTenantStaff: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        username: z.string().min(1),
        tempPassword: z.string().min(8).optional(),
        permissions: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireSystemAdmin(ctx.session);
      const tempPassword = input.tempPassword ?? generateTempPassword();
      const { hash, salt } = hashPassword({ password: tempPassword });

      const user = await createUser({
        tenantId: input.tenantId,
        username: input.username,
        role: "staff",
        passwordHash: hash,
        passwordSalt: salt,
        permissions: input.permissions,
      });

      return {
        userId: user.id,
        username: user.username,
        tempPassword,
      };
    }),
});
