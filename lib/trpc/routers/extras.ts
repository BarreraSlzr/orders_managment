import { dispatchDomainEvent } from "@/lib/events/dispatch";
import { getExtras } from "@/lib/sql/functions/extras";
import { getOrderItemsView } from "@/lib/sql/functions/getOrderItemsView";
import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../init";

export const extrasRouter = router({
  /** List all active extras (catalog) */
  list: protectedProcedure.query(async () => {
    return getExtras();
  }),

  /** Create or update an extra (admin only) */
  upsert: adminProcedure
    .input(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1),
        price: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      return dispatchDomainEvent({
        type: "extra.upserted",
        payload: {
          id: input.id ?? "",
          name: input.name,
          price: input.price,
        },
      });
    }),

  /** Soft-delete an extra (admin only) */
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return dispatchDomainEvent({
        type: "extra.deleted",
        payload: { id: input.id },
      });
    }),

  /** Toggle an extra on/off for a specific order item */
  toggleOnItem: protectedProcedure
    .input(
      z.object({
        orderItemId: z.number(),
        extraId: z.string(),
        orderId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      await dispatchDomainEvent({
        type: "order.item.extra.toggled",
        payload: {
          orderItemId: input.orderItemId,
          extraId: input.extraId,
        },
      });
      // Return refreshed order view so the UI updates
      return getOrderItemsView(input.orderId);
    }),
});
