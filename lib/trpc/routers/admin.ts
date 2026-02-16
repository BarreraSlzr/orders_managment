import { exportAllData, getTableCounts, validateSnapshot } from "@/lib/sql/backup";
import { getMigrationStatus } from "@/lib/sql/migrate";
import { allMigrations } from "@/lib/sql/migrations";
import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../init";

export const adminRouter = router({
  /** Check whether the current user has admin privileges */
  status: protectedProcedure.query(({ ctx }) => {
    return { isAdmin: ctx.isAdmin };
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
});
