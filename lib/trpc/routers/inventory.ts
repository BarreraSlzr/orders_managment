import { dispatchDomainEvent } from "@/lib/events/dispatch";
import { getCategories } from "@/lib/sql/functions/categories";
import { getItems } from "@/lib/sql/functions/inventory";
import { getTransactions } from "@/lib/sql/functions/transactions";
import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../init";

export const inventoryRouter = router({
  // ── Items ──────────────────────────────────────────────────────────
  items: router({
    list: protectedProcedure
      .input(z.object({ categoryId: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return getItems(input?.categoryId);
      }),

    add: adminProcedure
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

    toggle: adminProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        return dispatchDomainEvent({
          type: "inventory.item.toggled",
          payload: input,
        });
      }),

    delete: adminProcedure
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
    list: protectedProcedure
      .input(z.object({ itemId: z.string() }))
      .query(async ({ input }) => {
        return getTransactions(input.itemId);
      }),

    add: adminProcedure
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

    delete: adminProcedure
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
    list: protectedProcedure.query(async () => {
      return getCategories();
    }),

    upsert: adminProcedure
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

    delete: adminProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        return dispatchDomainEvent({
          type: "inventory.category.deleted",
          payload: input,
        });
      }),

    toggleItem: adminProcedure
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
