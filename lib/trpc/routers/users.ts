import { generateTempPassword, hashPassword } from "@/lib/auth/passwords";
import { parseUserRole } from "@/lib/auth/roles";
import {
    createUser,
    listStaffByTenant,
    updateUserPermissions,
} from "@/lib/sql/functions/users";
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

export const usersRouter = router({
  /** Manager view: list staff users in current tenant */
  listStaff: protectedProcedure.query(async ({ ctx }) => {
    requireManagerRole(ctx.session);
    const tenantId = getTenantId(ctx.session);
    return listStaffByTenant({ tenantId });
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
});
