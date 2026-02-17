import { dispatchDomainEvent } from "@/lib/events/dispatch";
import { db } from "@/lib/sql/database";
import { exportProductsJSON } from "@/lib/sql/functions/exportProductsJSON";
import { getProducts } from "@/lib/sql/functions/getProducts";
import {
  parseProductsCSV,
  type ProductRow,
} from "@/lib/utils/parseProductsCSV";
import { z } from "zod";
import { managerProcedure, tenantProcedure, router } from "../init";

export const productsRouter = router({
  list: tenantProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          tags: z.array(z.string()).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return getProducts({
        tenantId: ctx.tenantId,
        search: input?.search,
        tags: input?.tags,
      });
    }),

  upsert: managerProcedure
    .input(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1),
        price: z.number(),
        tags: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return dispatchDomainEvent({
        type: "product.upserted",
        payload: {
          tenantId: ctx.tenantId,
          id: input.id ?? "",
          name: input.name,
          price: input.price,
          tags: input.tags.replace(/\s*,\s*/g, ","),
        },
      });
    }),

  delete: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .deleteFrom("products")
        .where("id", "=", input.id)
        .where("tenant_id", "=", ctx.tenantId)
        .execute();
      return { success: true, id: input.id };
    }),

  export: tenantProcedure.query(async ({ ctx }) => {
    const result = await exportProductsJSON({ tenantId: ctx.tenantId });
    return { json: JSON.stringify(result?.rows || []) };
  }),

  /**
   * Bulk CSV upload — parses CSV text, validates rows, deduplicates
   * against existing products (by name), then upserts via domain events.
   */
  csvUpload: managerProcedure
    .input(z.object({ csv: z.string().min(1, "CSV content is required") }))
    .mutation(async ({ ctx, input }) => {
      const parsed = parseProductsCSV({ csv: input.csv });

      if (parsed.rows.length === 0) {
        return {
          imported: 0,
          skipped: 0,
          errors: parsed.errors,
          totalLines: parsed.totalLines,
        };
      }

      // Fetch existing products to detect duplicates by name
      const existing = await getProducts({ tenantId: ctx.tenantId });
      const existingByName = new Map(
        existing.map((p) => [p.name.toLowerCase(), p])
      );

      let imported = 0;
      let skipped = 0;
      const rowErrors = [...parsed.errors];

      for (let i = 0; i < parsed.rows.length; i++) {
        const row: ProductRow = parsed.rows[i];
        const existingProduct = existingByName.get(row.name.toLowerCase());

        try {
          await dispatchDomainEvent({
            type: "product.upserted",
            payload: {
              tenantId: ctx.tenantId,
              id: row.id ?? existingProduct?.id ?? "",
              name: row.name,
              price: row.price,
              tags: row.tags.replace(/\s*,\s*/g, ","),
            },
          });
          imported++;
        } catch (err) {
          rowErrors.push({
            line: i + 2, // +2: 1-indexed + header row
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

  /**
   * Reset & Import — deletes ALL existing products and imports from CSV.
   * Destructive operation — admin only.
   */
  resetAndImport: managerProcedure
    .input(z.object({ csv: z.string().min(1, "CSV content is required") }))
    .mutation(async ({ ctx, input }) => {
      const parsed = parseProductsCSV({ csv: input.csv });

      if (parsed.rows.length === 0) {
        return {
          imported: 0,
          skipped: 0,
          errors: parsed.errors,
          totalLines: parsed.totalLines,
        };
      }

      // Delete all existing products
      await db
        .deleteFrom("products")
        .where("tenant_id", "=", ctx.tenantId)
        .execute();

      let imported = 0;
      let skipped = 0;
      const rowErrors = [...parsed.errors];

      for (let i = 0; i < parsed.rows.length; i++) {
        const row: ProductRow = parsed.rows[i];

        try {
          await dispatchDomainEvent({
            type: "product.upserted",
            payload: {
              tenantId: ctx.tenantId,
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
});
