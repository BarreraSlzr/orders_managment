"use client";

import { useSSEInvalidation } from "@/hooks/useSSEInvalidation";
import { useTRPC } from "@/lib/trpc/react";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

/**
 * Renders nothing — activates the SSE connection for real-time
 * cache invalidation as a side-effect.
 *
 * Uses `useTRPC` to build the correct tRPC v11 query key for
 * `platform_alerts` so that `alerts.list` (and the unread badge
 * in the Settings FAB) refresh immediately when a new alert is
 * created, instead of waiting for the 60-second polling interval.
 *
 * Why a custom handler is needed:
 *   tRPC v11 stores query keys as `[pathArray, {input,type}]`.
 *   TanStack Query’s `partialDeepEqual` only prefix-matches when the
 *   first element of the stored key equals the first element of the
 *   filter key.  `trpc.alerts.list.queryKey()` returns `[["alerts","list"]]`
 *   (type=“any”), which correctly matches any `alerts.list` query
 *   regardless of input.
 */
export default function SSEInvalidationListener() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const handlers = useMemo(
    () => {
      /** Bust the order list + optionally the specific open detail. */
      const invalidateOrder = (id?: string) => {
        queryClient.invalidateQueries({ queryKey: trpc.orders.list.queryKey() });
        if (id) {
          queryClient.invalidateQueries({
            queryKey: trpc.orders.getDetails.queryKey({ id }),
          });
        }
      };

      return {
        // Orders — list + open detail
        orders: (_: unknown, event: { id?: string }) => invalidateOrder(event.id),

        // order_items / order_item_extras carry the parent orderId as `event.id`
        order_items: (_: unknown, event: { id?: string }) => invalidateOrder(event.id),
        order_item_extras: (_: unknown, event: { id?: string }) => invalidateOrder(event.id),

        // Products + export CSV
        products: () => {
          queryClient.invalidateQueries({ queryKey: trpc.products.list.queryKey() });
          queryClient.invalidateQueries({ queryKey: trpc.products.export.queryKey() });
        },

        // Product consumption / ingredient links
        product_consumptions: () => {
          queryClient.invalidateQueries({ queryKey: trpc.products.consumptions.list.queryKey() });
        },

        // Extras (toppings / add-ons)
        extras: () => {
          queryClient.invalidateQueries({ queryKey: trpc.extras.list.queryKey() });
        },

        // Inventory items + low-stock alerts
        inventory_items: () => {
          queryClient.invalidateQueries({ queryKey: trpc.inventory.items.list.queryKey() });
          queryClient.invalidateQueries({ queryKey: trpc.inventory.items.lowStock.queryKey() });
        },
        categories: () => {
          queryClient.invalidateQueries({ queryKey: trpc.inventory.categories.list.queryKey() });
        },
        // Transactions + derived daily-gastos / byDate views (all under inventory.transactions.*)
        transactions: () => {
          queryClient.invalidateQueries({ queryKey: trpc.inventory.transactions.list.queryKey() });
          queryClient.invalidateQueries({ queryKey: trpc.inventory.transactions.dailyGastos.queryKey() });
          queryClient.invalidateQueries({ queryKey: trpc.inventory.transactions.byDate.queryKey() });
        },

        // Platform alerts — tenant badge + admin dashboard
        platform_alerts: () => {
          queryClient.invalidateQueries({ queryKey: trpc.alerts.list.queryKey() });
          queryClient.invalidateQueries({ queryKey: trpc.alerts.adminList.queryKey() });
        },
      } as const;
    },
    [trpc, queryClient],
  );

  useSSEInvalidation({ handlers });
  return null;
}
