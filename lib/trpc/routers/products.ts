import { z } from "zod";
import { publicProcedure, router } from "../init";
import { getProducts } from "@/lib/sql/functions/getProducts";
import { exportProductsJSON } from "@/lib/sql/functions/exportProductsJSON";
import { dispatchDomainEvent } from "@/lib/events/dispatch";
import { db } from "@/lib/sql/database";

export const productsRouter = router({
  list: publicProcedure
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

  upsert: publicProcedure
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

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.deleteFrom("products").where("id", "=", input.id).execute();
      return { success: true, id: input.id };
    }),

  export: publicProcedure.query(async () => {
    const result = await exportProductsJSON();
    return { json: JSON.stringify(result?.rows || []) };
  }),
});
