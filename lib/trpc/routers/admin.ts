import { generateTempPassword, hashPassword } from "@/lib/auth/passwords";
import { dispatchDomainEvent } from "@/lib/events/dispatch";
import { db } from "@/lib/sql/database";
import { exportAllData, getTableCounts, validateSnapshot } from "@/lib/sql/backup";
import { listAdminAuditLogs } from "@/lib/sql/functions/adminAudit";
import { exportProductsJSON } from "@/lib/sql/functions/exportProductsJSON";
import { getProducts } from "@/lib/sql/functions/getProducts";
import { createTenant, getTenantByName, listTenants } from "@/lib/sql/functions/tenants";
import { createUser, listUsersByTenants } from "@/lib/sql/functions/users";
import { parseProductsCSV } from "@/lib/utils/parseProductsCSV";
import { getMigrationStatus } from "@/lib/sql/migrate";
import { allMigrations } from "@/lib/sql/migrations";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../init";

async function logAdminAccess(params: {
  action: string;
  adminId?: string;
  role?: string;
  tenantId?: string;
  targetTenantId?: string;
  metadata?: Record<string, unknown> | null;
}) {
  if (!params.adminId || !params.tenantId) {
    return;
  }

  await dispatchDomainEvent({
    type: "admin.audit.logged",
    payload: {
      tenantId: params.tenantId,
      adminId: params.adminId,
      role: params.role,
      action: params.action,
      targetTenantId: params.targetTenantId,
      metadata: params.metadata ?? null,
    },
  });
}

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
  migrationStatus: adminProcedure.query(async ({ ctx }) => {
    await logAdminAccess({
      action: "migrationStatus",
      adminId: ctx.session?.sub,
      role: ctx.session?.role,
      tenantId: ctx.session?.tenant_id,
    });
    return getMigrationStatus({ migrations: allMigrations });
  }),

  /** Get row counts for all business tables */
  tableCounts: adminProcedure.query(async ({ ctx }) => {
    await logAdminAccess({
      action: "tableCounts",
      adminId: ctx.session?.sub,
      role: ctx.session?.role,
      tenantId: ctx.session?.tenant_id,
    });
    return getTableCounts();
  }),

  /** List all tenants (superadmin) */
  listTenants: adminProcedure.query(async ({ ctx }) => {
    await logAdminAccess({
      action: "listTenants",
      adminId: ctx.session?.sub,
      role: ctx.session?.role,
      tenantId: ctx.session?.tenant_id,
    });
    return listTenants();
  }),

  /** List roster across tenants (system admin) */
  listTenantRoster: adminProcedure
    .input(z.object({ tenantId: z.string().min(1).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.session?.tenant_id;
      const tenantName = ctx.session?.tenant_name;

      if (!tenantId || !tenantName) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      await logAdminAccess({
        action: "listTenantRoster",
        adminId: ctx.session?.sub,
        role: ctx.session?.role,
        tenantId,
        metadata: {
          filterTenantId: input?.tenantId ?? null,
        },
      });

      const isSystemAdmin = tenantName === "system";
      const visibleRoles = ["manager", "staff"] as const;

      if (!isSystemAdmin) {
        const rows = await listUsersByTenants({
          tenantIds: [tenantId],
          roles: [...visibleRoles],
        });

        return {
          tenants: [
            {
              id: tenantId,
              name: tenantName,
              managers: rows.filter((user) => user.role === "manager"),
              staff: rows.filter((user) => user.role === "staff"),
            },
          ],
        };
      }

      const tenants = await listTenants();
      const targetTenantIds = input?.tenantId
        ? tenants.filter((tenant) => tenant.id === input.tenantId)
        : tenants;

      const tenantIds = targetTenantIds.map((tenant) => tenant.id);
      const rows = await listUsersByTenants({
        tenantIds,
        roles: [...visibleRoles],
      });

      const grouped = new Map(
        targetTenantIds.map((tenant) => [tenant.id, { ...tenant, managers: [], staff: [] }])
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

  /** Fetch default tenant (cafe&baguettes) */
  defaultTenant: adminProcedure.query(async ({ ctx }) => {
    await logAdminAccess({
      action: "defaultTenant",
      adminId: ctx.session?.sub,
      role: ctx.session?.role,
      tenantId: ctx.session?.tenant_id,
    });
    return getTenantByName({ name: "cafe&baguettes" });
  }),

  /** Export all data as a JSON snapshot */
  exportData: adminProcedure.query(async ({ ctx }) => {
    await logAdminAccess({
      action: "exportData",
      adminId: ctx.session?.sub,
      role: ctx.session?.role,
      tenantId: ctx.session?.tenant_id,
    });
    return exportAllData();
  }),

  /** List admin audit logs */
  listAuditLogs: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
        adminId: z.string().min(1).optional(),
        action: z.string().min(1).optional(),
        targetTenantId: z.string().min(1).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await logAdminAccess({
        action: "listAuditLogs",
        adminId: ctx.session?.sub,
        role: ctx.session?.role,
        tenantId: ctx.session?.tenant_id,
        metadata: {
          adminId: input.adminId,
          action: input.action,
          targetTenantId: input.targetTenantId,
          limit: input.limit,
          offset: input.offset,
        },
      });

      return listAdminAuditLogs({
        limit: input.limit,
        offset: input.offset,
        adminId: input.adminId,
        action: input.action,
        targetTenantId: input.targetTenantId,
      });
    }),

  /** Export products for a selected tenant */
  exportTenantProducts: adminProcedure
    .input(z.object({ tenantId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await logAdminAccess({
        action: "exportTenantProducts",
        adminId: ctx.session?.sub,
        role: ctx.session?.role,
        tenantId: ctx.session?.tenant_id,
        targetTenantId: input.tenantId,
      });
      const result = await exportProductsJSON({ tenantId: input.tenantId });
      return { json: JSON.stringify(result?.rows || []) };
    }),

  /** List products for a selected tenant */
  listTenantProducts: adminProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        search: z.string().optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await logAdminAccess({
        action: "listTenantProducts",
        adminId: ctx.session?.sub,
        role: ctx.session?.role,
        tenantId: ctx.session?.tenant_id,
        targetTenantId: input.tenantId,
        metadata: {
          search: input.search,
          tags: input.tags,
        },
      });
      return getProducts({
        tenantId: input.tenantId,
        search: input.search,
        tags: input.tags,
      });
    }),

  /** Import products CSV into a selected tenant (merge) */
  importTenantProducts: adminProcedure
    .input(
      z.object({ tenantId: z.string().min(1), csv: z.string().min(1) })
    )
    .mutation(async ({ ctx, input }) => {
      await logAdminAccess({
        action: "importTenantProducts",
        adminId: ctx.session?.sub,
        role: ctx.session?.role,
        tenantId: ctx.session?.tenant_id,
        targetTenantId: input.tenantId,
      });
      const parsed = parseProductsCSV({ csv: input.csv });

      if (parsed.rows.length === 0) {
        return {
          imported: 0,
          skipped: 0,
          errors: parsed.errors,
          totalLines: parsed.totalLines,
        };
      }

      const existing = await getProducts({ tenantId: input.tenantId });
      const existingByName = new Map(
        existing.map((p) => [p.name.toLowerCase(), p])
      );

      let imported = 0;
      let skipped = 0;
      const rowErrors = [...parsed.errors];

      for (let i = 0; i < parsed.rows.length; i++) {
        const row = parsed.rows[i];
        const existingProduct = existingByName.get(row.name.toLowerCase());

        try {
          await dispatchDomainEvent({
            type: "product.upserted",
            payload: {
              tenantId: input.tenantId,
              id: row.id ?? existingProduct?.id ?? "",
              name: row.name,
              price: row.price,
              tags: row.tags.replace(/\s*,\s*/g, ","),
            },
          });
          imported++;
        } catch (err) {
          rowErrors.push({
            line: i + 2,
            raw: `${row.name},${row.price},${row.tags}`,
            message:
              err instanceof Error ? err.message : "Unknown upsert error",
          });
          skipped++;
        }
      }

      return {
        imported,
        skipped,
        errors: rowErrors,
        totalLines: parsed.totalLines,
      };
    }),

  /** Reset & import products for a selected tenant */
  resetTenantProducts: adminProcedure
    .input(
      z.object({ tenantId: z.string().min(1), csv: z.string().min(1) })
    )
    .mutation(async ({ ctx, input }) => {
      await logAdminAccess({
        action: "resetTenantProducts",
        adminId: ctx.session?.sub,
        role: ctx.session?.role,
        tenantId: ctx.session?.tenant_id,
        targetTenantId: input.tenantId,
      });
      const parsed = parseProductsCSV({ csv: input.csv });

      if (parsed.rows.length === 0) {
        return {
          imported: 0,
          skipped: 0,
          errors: parsed.errors,
          totalLines: parsed.totalLines,
        };
      }

      await db
        .deleteFrom("products")
        .where("tenant_id", "=", input.tenantId)
        .execute();

      let imported = 0;
      let skipped = 0;
      const rowErrors = [...parsed.errors];

      for (let i = 0; i < parsed.rows.length; i++) {
        const row = parsed.rows[i];

        try {
          await dispatchDomainEvent({
            type: "product.upserted",
            payload: {
              tenantId: input.tenantId,
              id: row.id ?? "",
              name: row.name,
              price: row.price,
              tags: row.tags.replace(/\s*,\s*/g, ","),
            },
          });
          imported++;
        } catch (err) {
          rowErrors.push({
            line: i + 2,
            raw: `${row.name},${row.price},${row.tags}`,
            message:
              err instanceof Error ? err.message : "Unknown upsert error",
          });
          skipped++;
        }
      }

      return {
        imported,
        skipped,
        errors: rowErrors,
        totalLines: parsed.totalLines,
      };
    }),

  /** Validate a snapshot without importing it */
  validateSnapshot: adminProcedure
    .input(z.object({ data: z.unknown() }))
    .mutation(async ({ ctx, input }) => {
      await logAdminAccess({
        action: "validateSnapshot",
        adminId: ctx.session?.sub,
        role: ctx.session?.role,
        tenantId: ctx.session?.tenant_id,
      });
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
    .mutation(async ({ ctx, input }) => {
      await logAdminAccess({
        action: "onboardManager",
        adminId: ctx.session?.sub,
        role: ctx.session?.role,
        tenantId: ctx.session?.tenant_id,
      });
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
