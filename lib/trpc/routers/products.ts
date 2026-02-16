import { dispatchDomainEvent } from "@/lib/events/dispatch";
import { db } from "@/lib/sql/database";
import { exportProductsJSON } from "@/lib/sql/functions/exportProductsJSON";
import { getProducts } from "@/lib/sql/functions/getProducts";
import {
  parseProductsCSV,
  type ProductRow,
} from "@/lib/utils/parseProductsCSV";
import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../init";

export const productsRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          tags: z.array(z.string()).optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return getProducts(input?.search, input?.tags);
    }),

  upsert: adminProcedure
    .input(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1),
        price: z.number(),
        tags: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      return dispatchDomainEvent({
        type: "product.upserted",
        payload: {
          id: input.id ?? "",
          name: input.name,
          price: input.price,
          tags: input.tags.replace(/\s*,\s*/g, ","),
        },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.deleteFrom("products").where("id", "=", input.id).execute();
      return { success: true, id: input.id };
    }),

  export: protectedProcedure.query(async () => {
    const result = await exportProductsJSON();
    return { json: JSON.stringify(result?.rows || []) };
  }),

  /**
   * Bulk CSV upload — parses CSV text, validates rows, deduplicates
   * against existing products (by name), then upserts via domain events.
   */
  csvUpload: adminProcedure
    .input(z.object({ csv: z.string().min(1, "CSV content is required") }))
    .mutation(async ({ input }) => {
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
      const existing = await getProducts();
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
});
