import { dispatchDomainEvent } from "@/lib/events/dispatch";
import { featureGateService } from "@/lib/services/entitlements/featureGateService";
import { getOrderItemsView } from "@/lib/sql/functions/getOrderItemsView";
import { getOrders } from "@/lib/sql/functions/getOrders";
import { getIsoTimestamp } from "@/utils/stamp";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, tenantProcedure } from "../init";
import { requireRole } from "../tenancy";

function getActorUserId(session: Record<string, unknown> | null): string {
  const userId = session && typeof session.sub === "string" ? session.sub : "";
  if (!userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return userId;
}

async function assertFeatureAccess(params: {
  tenantId: string;
  userId: string;
  feature: "sales_history_extended" | "payment_method_advanced";
}): Promise<void> {
  try {
    await featureGateService.assert(params);
  } catch {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Tu plan no incluye esta funcionalidad.",
    });
  }
}

function isDateOutsideFreemiumHistory(params: { date: string; days: number }): boolean {
  const targetMs = Date.parse(`${params.date}T00:00:00Z`);
  if (!Number.isFinite(targetMs)) return false;
  const nowMs = Date.parse(getIsoTimestamp());
  const windowMs = params.days * 24 * 60 * 60 * 1000;
  return targetMs < nowMs - windowMs;
}

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
      if (input.date && isDateOutsideFreemiumHistory({ date: input.date, days: 30 })) {
        await assertFeatureAccess({
          tenantId: ctx.tenantId,
          userId: getActorUserId(ctx.session),
          feature: "sales_history_extended",
        });
      }

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
        defaultPaymentOptionId: z.number().optional(),
        defaultIsTakeaway: z.boolean().optional(),
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
            // Pass defaults to item creation for application
            defaultPaymentOptionId: input.defaultPaymentOptionId,
            defaultIsTakeaway: input.defaultIsTakeaway,
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

  open: tenantProcedure
    .input(z.object({ orderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.session, ["staff", "manager", "admin"]);
      return dispatchDomainEvent({
        type: "order.opened",
        payload: { tenantId: ctx.tenantId, ...input },
      });
    }),

  combine: tenantProcedure
    .input(
      z.object({
        targetOrderId: z.string(),
        sourceOrderIds: z.array(z.string()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.session, ["staff", "manager", "admin"]);
      return dispatchDomainEvent({
        type: "order.combined",
        payload: {
          tenantId: ctx.tenantId,
          targetOrderId: input.targetOrderId,
          sourceOrderIds: input.sourceOrderIds,
        },
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

  setPaymentOption: tenantProcedure
    .input(z.object({ itemIds: z.array(z.number()), paymentOptionId: z.number().min(1).max(6) }))
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.session, ["staff", "manager", "admin"]);
      await assertFeatureAccess({
        tenantId: ctx.tenantId,
        userId: getActorUserId(ctx.session),
        feature: "payment_method_advanced",
      });

      return dispatchDomainEvent({
        type: "order.payment.set",
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

  /**
   * Closes all open orders for a given date and runs EOD inventory deduction.
   * Idempotent — safe to call multiple times for the same date.
   */
  batchClose: tenantProcedure
    .input(z.object({ date: z.string() })) // 'YYYY-MM-DD'
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.session, ["manager", "admin"]);
      return dispatchDomainEvent({
        type: "order.batch.closed",
        payload: { tenantId: ctx.tenantId, date: input.date },
      });
    }),
});
