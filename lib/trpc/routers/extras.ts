import { dispatchDomainEvent } from "@/lib/events/dispatch";
import { getExtras } from "@/lib/sql/functions/extras";
import { getOrderItemsView } from "@/lib/sql/functions/getOrderItemsView";
import { z } from "zod";
import { managerProcedure, tenantProcedure, router } from "../init";

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
