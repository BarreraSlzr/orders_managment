"use client";

import { OrderItem, OrderItemsView } from "@/lib/sql/types";
import { useTRPC } from "@/lib/trpc/react";
import {
  Order,
  OrderContextActions,
  OrderContextState,
  OrdersQuery,
} from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─── Optimistic update helpers ───────────────────────────────────────────────

/** Apply a client-side optimistic patch to an OrderItemsView snapshot. */
function applyOptimisticUpdate(
  actionType: "remove" | "toggleTakeAway" | "updatePayment",
  prev: OrderItemsView,
  itemIds: Set<number>,
): OrderItemsView {
  switch (actionType) {
    case "remove": {
      const products: OrderItem[] = prev.products
        .map((p) => ({
          ...p,
          items: p.items.filter((i) => !itemIds.has(i.id)),
        }))
        .filter((p) => p.items.length > 0);
      return { ...prev, products };
    }
    case "toggleTakeAway": {
      const products: OrderItem[] = prev.products.map((p) => ({
        ...p,
        items: p.items.map((i) =>
          itemIds.has(i.id) ? { ...i, is_takeaway: !i.is_takeaway } : i,
        ),
      }));
      return { ...prev, products };
    }
    case "updatePayment": {
      const products: OrderItem[] = prev.products.map((p) => ({
        ...p,
        items: p.items.map((i) =>
          itemIds.has(i.id)
            // Toggle: 0 = no payment, 1 = paid (real value corrected on server re-fetch)
            ? { ...i, payment_option_id: i.payment_option_id ? 0 : 1 }
            : i,
        ),
      }));
      return { ...prev, products };
    }
  }
}

export interface InitOrdersProps {
  orders?: Order[];
  query?: OrdersQuery;
}

export function useOrders({
  query: initialQuery = {},
}: InitOrdersProps): OrderContextState & OrderContextActions {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState<OrdersQuery>(initialQuery);
  // currentOrderId is stored in the URL as ?orderId=... for deep-linking and testability
  const [currentOrderId, setCurrentOrderId] = useQueryState(
    "orderId",
    parseAsString.withDefault(""),
  );

  // Ref always holds the latest value — avoids stale nuqs closure in callbacks
  const currentOrderIdRef = useRef(currentOrderId);
  useEffect(() => {
    currentOrderIdRef.current = currentOrderId;
  }, [currentOrderId]);

  // Fetch orders list via tRPC
  const listOpts = trpc.orders.list.queryOptions({
    timeZone: query.timeZone ?? "America/Mexico_City",
    date: query.date,
    status: query.status,
  });
  const ordersResult = useQuery(listOpts);

  // Fetch current order details via tRPC (currentOrderId is "" when nothing selected)
  const detailOpts = trpc.orders.getDetails.queryOptions(
    { id: currentOrderId },
    { enabled: !!currentOrderId },
  );
  const detailQuery = useQuery(detailOpts);

  // Derived — no useEffect sync needed, eliminates one render cycle of latency
  const currentOrder = useMemo<OrderItemsView | null>(() => {
    if (!currentOrderId) return null;
    return (detailQuery.data as OrderItemsView) ?? null;
  }, [currentOrderId, detailQuery.data]);

  // Mutations
  const splitMutation = useMutation(trpc.orders.split.mutationOptions());
  const closeMutation = useMutation(trpc.orders.close.mutationOptions());
  const removeProductsMutation = useMutation(
    trpc.orders.removeProducts.mutationOptions(),
  );
  const togglePaymentMutation = useMutation(
    trpc.orders.togglePayment.mutationOptions(),
  );
  const toggleTakeawayMutation = useMutation(
    trpc.orders.toggleTakeaway.mutationOptions(),
  );

  // Invalidation helpers
  const invalidateOrders = useCallback(
    () => queryClient.invalidateQueries({ queryKey: listOpts.queryKey }),
    [queryClient, listOpts.queryKey],
  );
  const invalidateDetail = useCallback(() => {
    // Read from ref so we always use the live value, not a stale closure snapshot
    const id = currentOrderIdRef.current;
    if (id) {
      queryClient.invalidateQueries({
        queryKey: trpc.orders.getDetails.queryOptions({ id }, { enabled: true })
          .queryKey,
      });
    }
  }, [queryClient, trpc.orders.getDetails]);

  useEffect(() => {
    const closeHandler = () => void setCurrentOrderId("");
    window.addEventListener("close-order-details", closeHandler);
    return () =>
      window.removeEventListener("close-order-details", closeHandler);
  }, [setCurrentOrderId]);

  const orders = useMemo(
    () =>
      new Map<string, Order>(
        ordersResult.data?.map((o: Order) => [o.id, o]) ?? [],
      ),
    [ordersResult.data],
  );

  const fetchOrders = async (updatedQuery: Partial<OrdersQuery> = {}) => {
    setQuery((prev) => ({ ...prev, ...updatedQuery }));
    await invalidateOrders();
  };

  const updateOrder = (updatedOrder: OrderItemsView | null) => {
    if (updatedOrder) {
      if (!orders.has(updatedOrder.id)) {
        invalidateOrders();
      }
      setCurrentOrderId(updatedOrder.id);
    } else {
      setCurrentOrderId("");
    }
    invalidateDetail();
  };

  return {
    isPending: ordersResult.isLoading || detailQuery.isLoading,
    orders,
    currentOrder,
    fetchOrders,
    updateCurrentOrder: updateOrder,

    async handleUpdateItemDetails(actionType, formData) {
      const orderId = formData.get("orderId") as string;
      const itemIdsRaw = formData.getAll("itemIds").map((v) => Number(v));
      const itemIdSet = new Set(itemIdsRaw);

      // ── Optimistic update ─────────────────────────────────────────────────
      // Patch the cache immediately so the UI reflects the change before the
      // network round-trip completes. On error we roll back to the snapshot.
      const liveId = currentOrderIdRef.current;
      const detailKey = trpc.orders.getDetails.queryOptions(
        { id: liveId },
        { enabled: true },
      ).queryKey;
      const snapshot = queryClient.getQueryData<OrderItemsView>(detailKey);
      if (snapshot) {
        queryClient.setQueryData(
          detailKey,
          applyOptimisticUpdate(actionType, snapshot, itemIdSet),
        );
      }

      let success = false;
      try {
        switch (actionType) {
          case "remove":
            await removeProductsMutation.mutateAsync({
              orderId,
              itemIds: itemIdsRaw,
            });
            success = true;
            break;
          case "toggleTakeAway":
            await toggleTakeawayMutation.mutateAsync({ itemIds: itemIdsRaw });
            success = true;
            break;
          case "updatePayment":
            await togglePaymentMutation.mutateAsync({ itemIds: itemIdsRaw });
            success = true;
            break;
          default:
            throw new Error(`Unknown action type: ${actionType}`);
        }
      } catch {
        // Roll back optimistic patch on failure
        if (snapshot) queryClient.setQueryData(detailKey, snapshot);
        success = false;
      }

      if (success) {
        // Re-fetch authoritative data from server (replaces the optimistic patch)
        await invalidateDetail();
        await invalidateOrders();
      }
      return success;
    },

    async handleSplitOrder(formData: FormData) {
      const orderId = formData.get("orderId") as string;
      const itemIds = formData.getAll("itemIds").map((v) => Number(v));
      try {
        const result = await splitMutation.mutateAsync({ orderId, itemIds });
        await invalidateOrders();
        if (result) {
          updateOrder((result.newOrder as unknown) as OrderItemsView);
        }
        return true;
      } catch {
        return false;
      }
    },

    async handleCloseOrder(formData: FormData) {
      const orderId = formData.get("orderId") as string;
      try {
        await closeMutation.mutateAsync({ orderId });
        void setCurrentOrderId("");
        await invalidateOrders();
        return true;
      } catch {
        return false;
      }
    },

    async setCurrentOrderDetails(order: Order | null) {
      if (!order) {
        void setCurrentOrderId("");
        return;
      }
      void setCurrentOrderId(order.id);
      invalidateDetail();
    },
  };
}
