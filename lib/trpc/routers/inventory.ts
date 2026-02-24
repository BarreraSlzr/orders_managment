import { dispatchDomainEvent } from "@/lib/events/dispatch";
import { getCategories } from "@/lib/sql/functions/categories";
import { getItems, getLowStockAlerts } from "@/lib/sql/functions/inventory";
import { getDailyGastos, getGastosByDate, getTransactions } from "@/lib/sql/functions/transactions";
import { z } from "zod";
import { managerProcedure, router, tenantProcedure } from "../init";

export const inventoryRouter = router({
  // ── Items ──────────────────────────────────────────────────────────
  items: router({
    list: tenantProcedure
      .input(z.object({ categoryId: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return getItems({ tenantId: ctx.tenantId, categoryId: input?.categoryId });
      }),

    add: managerProcedure
      .input(
        z.object({
          name: z.string().min(1),
          quantityTypeKey: z.string().min(1),
          categoryId: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return dispatchDomainEvent({
          type: "inventory.item.added",
          payload: { tenantId: ctx.tenantId, ...input },
        });
      }),

    toggle: managerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return dispatchDomainEvent({
          type: "inventory.item.toggled",
          payload: { tenantId: ctx.tenantId, ...input },
        });
      }),

    delete: managerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return dispatchDomainEvent({
          type: "inventory.item.deleted",
          payload: { tenantId: ctx.tenantId, ...input },
        });
      }),

    lowStock: tenantProcedure.query(async ({ ctx }) => {
      return getLowStockAlerts({ tenantId: ctx.tenantId });
    }),
  }),

  // ── Transactions ───────────────────────────────────────────────────
  transactions: router({
    list: tenantProcedure
      .input(z.object({ itemId: z.string() }))
      .query(async ({ ctx, input }) => {
        return getTransactions({ tenantId: ctx.tenantId, itemId: input.itemId });
      }),

    upsert: tenantProcedure
      .input(
        z.object({
          itemId: z.string(),
          type: z.enum(["IN", "OUT"]),
          price: z.number(),
          quantity: z.number(),
          quantityTypeValue: z.string(),
          id: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return dispatchDomainEvent({
          type: "inventory.transaction.upserted",
          payload: { tenantId: ctx.tenantId, ...input },
        });
      }),

    delete: tenantProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return dispatchDomainEvent({
          type: "inventory.transaction.deleted",
          payload: { tenantId: ctx.tenantId, ...input },
        });
      }),

    dailyGastos: tenantProcedure
      .input(z.object({ date: z.string() })) // 'YYYY-MM-DD'
      .query(async ({ ctx, input }) => {
        return getDailyGastos({ tenantId: ctx.tenantId, date: input.date });
      }),

    byDate: tenantProcedure
      .input(z.object({ date: z.string() }))
      .query(async ({ ctx, input }) => {
        return getGastosByDate({ tenantId: ctx.tenantId, date: input.date });
      }),

  }),

  // ── Categories ─────────────────────────────────────────────────────
  categories: router({
    list: tenantProcedure.query(async ({ ctx }) => {
      return getCategories({ tenantId: ctx.tenantId });
    }),

    upsert: managerProcedure
      .input(
        z.object({
          id: z.string().optional(),
          name: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return dispatchDomainEvent({
          type: "inventory.category.upserted",
          payload: { tenantId: ctx.tenantId, ...input },
        });
      }),

    delete: managerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return dispatchDomainEvent({
          type: "inventory.category.deleted",
          payload: { tenantId: ctx.tenantId, ...input },
        });
      }),

    toggleItem: managerProcedure
      .input(
        z.object({
          categoryId: z.string(),
          itemId: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return dispatchDomainEvent({
          type: "inventory.category.item.toggled",
          payload: { tenantId: ctx.tenantId, ...input },
        });
      }),
  }),
});
