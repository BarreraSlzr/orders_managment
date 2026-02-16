import { dispatchDomainEvent } from "@/lib/events/dispatch";
import { getOrderItemsView } from "@/lib/sql/functions/getOrderItemsView";
import { getOrders } from "@/lib/sql/functions/getOrders";
import { z } from "zod";
import { publicProcedure, router } from "../init";

export const ordersRouter = router({
  list: publicProcedure
    .input(
      z.object({
        timeZone: z.string().default("America/Mexico_City"),
        date: z.string().optional(),
        status: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      return getOrders(input);
    }),

  getDetails: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return getOrderItemsView(input.id);
    }),

  create: publicProcedure
    .input(
      z.object({
        timeZone: z.string().default("America/Mexico_City"),
        productId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const order = await dispatchDomainEvent({
        type: "order.created",
        payload: { timeZone: input.timeZone },
      });

      if (input.productId) {
        await dispatchDomainEvent({
          type: "order.item.updated",
          payload: {
            orderId: order.id,
            productId: input.productId,
            type: "INSERT",
          },
        });
      }

      return getOrderItemsView(order.id);
    }),

  updateItem: publicProcedure
    .input(
      z.object({
        orderId: z.string(),
        productId: z.string(),
        type: z.enum(["INSERT", "DELETE"]),
      })
    )
    .mutation(async ({ input }) => {
      await dispatchDomainEvent({
        type: "order.item.updated",
        payload: input,
      });
      return getOrderItemsView(input.orderId);
    }),

  split: publicProcedure
    .input(
      z.object({
        orderId: z.string(),
        itemIds: z.array(z.number()),
      })
    )
    .mutation(async ({ input }) => {
      return dispatchDomainEvent({
        type: "order.split",
        payload: {
          oldOrderId: input.orderId,
          itemIds: input.itemIds,
        },
      });
    }),

  close: publicProcedure
    .input(z.object({ orderId: z.string() }))
    .mutation(async ({ input }) => {
      return dispatchDomainEvent({
        type: "order.closed",
        payload: input,
      });
    }),

  togglePayment: publicProcedure
    .input(z.object({ itemIds: z.array(z.number()) }))
    .mutation(async ({ input }) => {
      return dispatchDomainEvent({
        type: "order.payment.toggled",
        payload: input,
      });
    }),

  toggleTakeaway: publicProcedure
    .input(z.object({ itemIds: z.array(z.number()) }))
    .mutation(async ({ input }) => {
      return dispatchDomainEvent({
        type: "order.takeaway.toggled",
        payload: input,
      });
    }),

  removeProducts: publicProcedure
    .input(
      z.object({
        orderId: z.string(),
        itemIds: z.array(z.number()),
      })
    )
    .mutation(async ({ input }) => {
      const result = await dispatchDomainEvent({
        type: "order.products.removed",
        payload: input,
      });
      return result.pop()?.numDeletedRows;
    }),
});
