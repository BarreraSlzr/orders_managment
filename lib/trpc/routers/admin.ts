import { generateTempPassword, hashPassword } from "@/lib/auth/passwords";
import { exportAllData, getTableCounts, validateSnapshot } from "@/lib/sql/backup";
import { createTenant } from "@/lib/sql/functions/tenants";
import { createUser } from "@/lib/sql/functions/users";
import { getMigrationStatus } from "@/lib/sql/migrate";
import { allMigrations } from "@/lib/sql/migrations";
import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../init";

export const adminRouter = router({
  /** Check whether the current user has admin privileges */
  status: publicProcedure.query(({ ctx }) => {
    const role = typeof ctx.session?.role === "string" ? ctx.session.role : null;
    const tenantName =
      typeof ctx.session?.tenant_name === "string"
        ? ctx.session.tenant_name
        : null;
    return { isAdmin: ctx.isAdmin, role, tenantName };
  }),

  /** Get current migration status */
  migrationStatus: adminProcedure.query(async () => {
    return getMigrationStatus({ migrations: allMigrations });
  }),

  /** Get row counts for all business tables */
  tableCounts: adminProcedure.query(async () => {
    return getTableCounts();
  }),

  /** Export all data as a JSON snapshot */
  exportData: adminProcedure.query(async () => {
    return exportAllData();
  }),

  /** Validate a snapshot without importing it */
  validateSnapshot: adminProcedure
    .input(z.object({ data: z.unknown() }))
    .mutation(({ input }) => {
      return validateSnapshot({ data: input.data });
    }),

  /** Superadmin onboarding: create tenant + manager user */
  onboardManager: adminProcedure
    .input(
      z.object({
        tenantName: z.string().min(1),
        managerUsername: z.string().min(1),
        tempPassword: z.string().min(8).optional(),
      })
    )
    .mutation(async ({ input }) => {
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
});
