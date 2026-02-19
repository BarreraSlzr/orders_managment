"use client";

import { OrderItem, OrderItemsView } from "@/lib/sql/types";
import { useTRPC } from "@/lib/trpc/react";
import {
  Order,
  OrderContextActions,
  OrderContextState,
  OrdersQuery,
} from "@/lib/types";
import { getIsoTimestamp } from "@/utils/stamp";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseAsArrayOf, parseAsString, useQueryState } from "nuqs";
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
            ? // Toggle: 1 = Cash ↔ 3 = Credit Card (matches DB toggle)
              { ...i, payment_option_id: i.payment_option_id === 1 ? 3 : 1 }
            : i,
        ),
      }));
      return { ...prev, products };
    }
  }
}

/** Optimistic patch: set an explicit payment_option_id on matched items. */
function applySetPayment(
  prev: OrderItemsView,
  itemIds: Set<number>,
  paymentOptionId: number,
): OrderItemsView {
  const products: OrderItem[] = prev.products.map((p) => ({
    ...p,
    items: p.items.map((i) =>
      itemIds.has(i.id) ? { ...i, payment_option_id: paymentOptionId } : i,
    ),
  }));
  return { ...prev, products };
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

  // selectedOrderIds is stored in the URL as ?selected=id1,id2 for multi-select
  const [selectedOrderIds, setSelectedOrderIds] = useQueryState(
    "selected",
    parseAsArrayOf(parseAsString).withDefault([]),
  );

  // Ref always holds the latest value — avoids stale nuqs closure in callbacks
  const currentOrderIdRef = useRef(currentOrderId);
  useEffect(() => {
    currentOrderIdRef.current = currentOrderId;
  }, [currentOrderId]);

  // When exactly 1 order is selected, treat it as the active detail without
  // writing to ?orderId — keeps the URL clean (no duplicate params).
  // Priority: selection > explicit orderId deep-link.
  const detailId =
    selectedOrderIds.length === 1 ? selectedOrderIds[0] : currentOrderId;

  // Keep ref in sync with whichever source is active
  useEffect(() => {
    currentOrderIdRef.current = detailId;
  }, [detailId]);

  // Fetch orders list via tRPC
  const listOpts = trpc.orders.list.queryOptions({
    timeZone: query.timeZone ?? "America/Mexico_City",
    date: query.date,
    status: query.status,
  });
  const ordersResult = useQuery(listOpts);

  // Fetch current order details via tRPC (detailId is "" when nothing active)
  const detailOpts = trpc.orders.getDetails.queryOptions(
    { id: detailId },
    { enabled: !!detailId },
  );
  const detailQuery = useQuery(detailOpts);

  // Derived — no useEffect sync needed, eliminates one render cycle of latency
  const currentOrder = useMemo<OrderItemsView | null>(() => {
    if (!detailId) return null;
    return (detailQuery.data as OrderItemsView) ?? null;
  }, [detailId, detailQuery.data]);

  // Mutations
  const splitMutation = useMutation(trpc.orders.split.mutationOptions());
  const closeMutation = useMutation(trpc.orders.close.mutationOptions());
  const openMutation = useMutation(trpc.orders.open.mutationOptions());
  const combineMutation = useMutation(trpc.orders.combine.mutationOptions());
  const removeProductsMutation = useMutation(
    trpc.orders.removeProducts.mutationOptions(),
  );
  const togglePaymentMutation = useMutation(
    trpc.orders.togglePayment.mutationOptions(),
  );
  const setPaymentMutation = useMutation(
    trpc.orders.setPaymentOption.mutationOptions(),
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
    const closeHandler = () => {
      void setCurrentOrderId("");
      void setSelectedOrderIds([]);
    };
    window.addEventListener("close-order-details", closeHandler);
    return () =>
      window.removeEventListener("close-order-details", closeHandler);
  }, [setCurrentOrderId, setSelectedOrderIds]);

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
    selectedOrderIds,
    fetchOrders,
    updateCurrentOrder: updateOrder,

    async handleUpdateItemDetails(actionType, formData) {
      const orderId = formData.get("orderId") as string;
      const itemIdsRaw = formData.getAll("item_id").map((v) => Number(v));
      if (itemIdsRaw.length === 0) return false; // nothing checked
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
        // Actively refetch orders list so order total updates in the list view
        await queryClient.refetchQueries({ queryKey: listOpts.queryKey });
      }
      return success;
    },

    async handleSetPaymentOption({ orderId, itemIds, paymentOptionId }) {
      const itemIdSet = new Set(itemIds);

      // ── Optimistic update ─────────────────────────────────────────────
      const liveId = currentOrderIdRef.current;
      const detailKey = trpc.orders.getDetails.queryOptions(
        { id: liveId },
        { enabled: true },
      ).queryKey;
      const snapshot = queryClient.getQueryData<OrderItemsView>(detailKey);
      if (snapshot) {
        queryClient.setQueryData(
          detailKey,
          applySetPayment(snapshot, itemIdSet, paymentOptionId),
        );
      }

      let success = false;
      try {
        await setPaymentMutation.mutateAsync({ itemIds, paymentOptionId });
        success = true;
      } catch {
        if (snapshot) queryClient.setQueryData(detailKey, snapshot);
      }

      if (success) {
        await invalidateDetail();
        // Actively refetch orders list to keep it in sync
        await queryClient.refetchQueries({ queryKey: listOpts.queryKey });
      }
      return success;
    },

    async handleSplitOrder(formData: FormData) {
      const orderId = formData.get("orderId") as string;
      const itemIds = formData.getAll("item_id").map((v) => Number(v));
      try {
        const result = await splitMutation.mutateAsync({ orderId, itemIds });
        // Refetch orders list after split
        await queryClient.refetchQueries({ queryKey: listOpts.queryKey });
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
      const detailKey = trpc.orders.getDetails.queryOptions(
        { id: orderId },
        { enabled: true },
      ).queryKey;
      const snapshot = queryClient.getQueryData<OrderItemsView>(detailKey);
      if (snapshot) {
        queryClient.setQueryData<OrderItemsView>(detailKey, {
          ...snapshot,
          closed: (getIsoTimestamp() as unknown) as OrderItemsView["closed"],
        });
      }
      try {
        await closeMutation.mutateAsync({ orderId });
        // Refetch orders list after closing
        await queryClient.refetchQueries({ queryKey: listOpts.queryKey });
        return true;
      } catch {
        if (snapshot) {
          queryClient.setQueryData<OrderItemsView>(detailKey, snapshot);
        }
        return false;
      }
    },

    async handleOpenOrder(formData: FormData) {
      const orderId = formData.get("orderId") as string;
      try {
        await openMutation.mutateAsync({ orderId });
        // Refetch orders list and detail after reopening
        await queryClient.refetchQueries({ queryKey: listOpts.queryKey });
        invalidateDetail();
        return true;
      } catch {
        return false;
      }
    },

    async handleStartMercadoPagoSync({ orderId }) {
      console.info("Mercado Pago sync requested", { orderId });
    },

    async setCurrentOrderDetails(order: Order | null) {
      if (!order) {
        void setCurrentOrderId("");
        return;
      }
      void setCurrentOrderId(order.id);
      invalidateDetail();
    },

    toggleOrderSelection(orderId: string) {
      setSelectedOrderIds((prev) => {
        const set = new Set(prev ?? []);
        if (set.has(orderId)) {
          set.delete(orderId);
        } else {
          set.add(orderId);
          // When entering multi-select keep currentOrderId stable for single-view
        }
        return Array.from(set);
      });
    },

    selectSingleOrder(orderId: string) {
      // Replace entire selection with just this order, or clear if already the sole selection
      setSelectedOrderIds((prev) =>
        prev.length === 1 && prev[0] === orderId ? [] : [orderId],
      );
    },

    clearOrderSelection() {
      void setSelectedOrderIds([]);
    },

    async handleCombineOrders() {
      if (selectedOrderIds.length < 2) return false;
      const [targetOrderId, ...sourceOrderIds] = selectedOrderIds;
      try {
        await combineMutation.mutateAsync({ targetOrderId, sourceOrderIds });
        void setSelectedOrderIds([]);
        void setCurrentOrderId(targetOrderId);
        // Refetch orders list and detail after combine
        await queryClient.refetchQueries({ queryKey: listOpts.queryKey });
        invalidateDetail();
        return true;
      } catch {
        return false;
      }
    },

    async handleCloseMultiple() {
      if (selectedOrderIds.length === 0) return false;
      try {
        await Promise.all(
          selectedOrderIds.map((orderId) =>
            closeMutation.mutateAsync({ orderId }),
          ),
        );
        void setSelectedOrderIds([]);
        void setCurrentOrderId("");
        // Refetch orders list after closing multiple
        await queryClient.refetchQueries({ queryKey: listOpts.queryKey });
        return true;
      } catch {
        return false;
      }
    },
  };
}
