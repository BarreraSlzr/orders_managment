import { dispatchDomainEvent } from "@/lib/events/dispatch";
import { featureGateService } from "@/lib/services/entitlements/featureGateService";
import { getExtras } from "@/lib/sql/functions/extras";
import { getOrderItemsView } from "@/lib/sql/functions/getOrderItemsView";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { managerProcedure, router, tenantProcedure } from "../init";

function getActorUserId(session: Record<string, unknown> | null): string {
  const userId = session && typeof session.sub === "string" ? session.sub : "";
  if (!userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return userId;
}

async function assertOrderExpensesAccess(params: {
  tenantId: string;
  userId: string;
}): Promise<void> {
  try {
    await featureGateService.assert({
      tenantId: params.tenantId,
      userId: params.userId,
      feature: "order_expenses",
    });
  } catch {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Tu plan no incluye gastos por orden.",
    });
  }
}

export const extrasRouter = router({
  /** List all active extras (catalog) */
  list: tenantProcedure.query(async ({ ctx }) => {
    return getExtras({ tenantId: ctx.tenantId });
  }),

  /** Create or update an extra (admin only) */
  upsert: managerProcedure
    .input(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1),
        price: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertOrderExpensesAccess({
        tenantId: ctx.tenantId,
        userId: getActorUserId(ctx.session),
      });

      return dispatchDomainEvent({
        type: "extra.upserted",
        payload: {
          tenantId: ctx.tenantId,
          id: input.id ?? "",
          name: input.name,
          price: input.price,
        },
      });
    }),

  /** Soft-delete an extra (admin only) */
  delete: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertOrderExpensesAccess({
        tenantId: ctx.tenantId,
        userId: getActorUserId(ctx.session),
      });

      return dispatchDomainEvent({
        type: "extra.deleted",
        payload: { tenantId: ctx.tenantId, id: input.id },
      });
    }),

  /** Toggle an extra on/off for a specific order item */
  toggleOnItem: tenantProcedure
    .input(
      z.object({
        orderItemId: z.number(),
        extraId: z.string(),
        orderId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertOrderExpensesAccess({
        tenantId: ctx.tenantId,
        userId: getActorUserId(ctx.session),
      });

      await dispatchDomainEvent({
        type: "order.item.extra.toggled",
        payload: {
          tenantId: ctx.tenantId,
          orderItemId: input.orderItemId,
          extraId: input.extraId,
        },
      });
      // Return refreshed order view so the UI updates
      return getOrderItemsView({ tenantId: ctx.tenantId, orderId: input.orderId });
    }),
});
