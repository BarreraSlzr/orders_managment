import { dispatchDomainEvent } from "@/lib/events/dispatch";
import { getOrderItemsView } from "@/lib/sql/functions/getOrderItemsView";
import { getOrders } from "@/lib/sql/functions/getOrders";
import { z } from "zod";
import { tenantProcedure, router } from "../init";
import { requireRole } from "../tenancy";

export const ordersRouter = router({
  list: tenantProcedure
    .input(
      z.object({
        timeZone: z.string().default("America/Mexico_City"),
        date: z.string().optional(),
        status: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return getOrders({
        tenantId: ctx.tenantId,
        timeZone: input.timeZone,
        date: input.date,
        status: input.status,
      });
    }),

  getDetails: tenantProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return getOrderItemsView({ tenantId: ctx.tenantId, orderId: input.id });
    }),

  create: tenantProcedure
    .input(
      z.object({
        timeZone: z.string().default("America/Mexico_City"),
        productId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.session, ["staff", "manager", "admin"]);
      const order = await dispatchDomainEvent({
        type: "order.created",
        payload: { tenantId: ctx.tenantId, timeZone: input.timeZone },
      });

      if (input.productId) {
        await dispatchDomainEvent({
          type: "order.item.updated",
          payload: {
            tenantId: ctx.tenantId,
            orderId: order.id,
            productId: input.productId,
            type: "INSERT",
          },
        });
      }

      return getOrderItemsView({ tenantId: ctx.tenantId, orderId: order.id });
    }),

  updateItem: tenantProcedure
    .input(
      z.object({
        orderId: z.string(),
        productId: z.string(),
        type: z.enum(["INSERT", "DELETE"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.session, ["staff", "manager", "admin"]);
      await dispatchDomainEvent({
        type: "order.item.updated",
        payload: { tenantId: ctx.tenantId, ...input },
      });
      return getOrderItemsView({ tenantId: ctx.tenantId, orderId: input.orderId });
    }),

  split: tenantProcedure
    .input(
      z.object({
        orderId: z.string(),
        itemIds: z.array(z.number()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.session, ["staff", "manager", "admin"]);
      return dispatchDomainEvent({
        type: "order.split",
        payload: {
          tenantId: ctx.tenantId,
          oldOrderId: input.orderId,
          itemIds: input.itemIds,
        },
      });
    }),

  close: tenantProcedure
    .input(z.object({ orderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.session, ["staff", "manager", "admin"]);
      return dispatchDomainEvent({
        type: "order.closed",
        payload: { tenantId: ctx.tenantId, ...input },
      });
    }),

  togglePayment: tenantProcedure
    .input(z.object({ itemIds: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.session, ["staff", "manager", "admin"]);
      return dispatchDomainEvent({
        type: "order.payment.toggled",
        payload: { tenantId: ctx.tenantId, ...input },
      });
    }),

  toggleTakeaway: tenantProcedure
    .input(z.object({ itemIds: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.session, ["staff", "manager", "admin"]);
      return dispatchDomainEvent({
        type: "order.takeaway.toggled",
        payload: { tenantId: ctx.tenantId, ...input },
      });
    }),

  removeProducts: tenantProcedure
    .input(
      z.object({
        orderId: z.string(),
        itemIds: z.array(z.number()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.session, ["staff", "manager", "admin"]);
      const result = await dispatchDomainEvent({
        type: "order.products.removed",
        payload: { tenantId: ctx.tenantId, ...input },
      });
      return result.pop()?.numDeletedRows;
    }),
});
