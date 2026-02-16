import { dispatchDomainEvent } from "@/lib/events/dispatch";
import { db } from "@/lib/sql/database";
import { exportProductsJSON } from "@/lib/sql/functions/exportProductsJSON";
import { getProducts } from "@/lib/sql/functions/getProducts";
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
});
