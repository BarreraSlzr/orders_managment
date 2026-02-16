import { dispatchDomainEvent } from "@/lib/events/dispatch";
import { getCategories } from "@/lib/sql/functions/categories";
import { getItems } from "@/lib/sql/functions/inventory";
import { getTransactions } from "@/lib/sql/functions/transactions";
import { z } from "zod";
import { publicProcedure, router } from "../init";

export const inventoryRouter = router({
  // ── Items ──────────────────────────────────────────────────────────
  items: router({
    list: publicProcedure
      .input(z.object({ categoryId: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return getItems(input?.categoryId);
      }),

    add: publicProcedure
      .input(
        z.object({
          name: z.string().min(1),
          quantityTypeKey: z.string().min(1),
          categoryId: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return dispatchDomainEvent({
          type: "inventory.item.added",
          payload: input,
        });
      }),

    toggle: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        return dispatchDomainEvent({
          type: "inventory.item.toggled",
          payload: input,
        });
      }),

    delete: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        return dispatchDomainEvent({
          type: "inventory.item.deleted",
          payload: input,
        });
      }),
  }),

  // ── Transactions ───────────────────────────────────────────────────
  transactions: router({
    list: publicProcedure
      .input(z.object({ itemId: z.string() }))
      .query(async ({ input }) => {
        return getTransactions(input.itemId);
      }),

    add: publicProcedure
      .input(
        z.object({
          itemId: z.string(),
          type: z.enum(["IN", "OUT"]),
          price: z.number(),
          quantity: z.number(),
          quantityTypeValue: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        return dispatchDomainEvent({
          type: "inventory.transaction.added",
          payload: input,
        });
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return dispatchDomainEvent({
          type: "inventory.transaction.deleted",
          payload: input,
        });
      }),
  }),

  // ── Categories ─────────────────────────────────────────────────────
  categories: router({
    list: publicProcedure.query(async () => {
      return getCategories();
    }),

    upsert: publicProcedure
      .input(
        z.object({
          id: z.string().optional(),
          name: z.string().min(1),
        })
      )
      .mutation(async ({ input }) => {
        return dispatchDomainEvent({
          type: "inventory.category.upserted",
          payload: input,
        });
      }),

    delete: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        return dispatchDomainEvent({
          type: "inventory.category.deleted",
          payload: input,
        });
      }),

    toggleItem: publicProcedure
      .input(
        z.object({
          categoryId: z.string(),
          itemId: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        return dispatchDomainEvent({
          type: "inventory.category.item.toggled",
          payload: input,
        });
      }),
  }),
});
