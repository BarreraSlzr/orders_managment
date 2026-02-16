"use client";
import { useOrders } from "@/context/useOrders";
import { OrderItemsView } from "@/lib/sql/types";
import { useTRPC } from "@/lib/trpc/react";
import { OrderItemsContextActions } from "@/lib/types";
import { useMutation } from "@tanstack/react-query";

export function useOrderItemsProducts(): OrderItemsContextActions {
  const trpc = useTRPC();
  const { currentOrder, updateCurrentOrder } = useOrders();

  const createMutation = useMutation(trpc.orders.create.mutationOptions());
  const updateItemMutation = useMutation(
    trpc.orders.updateItem.mutationOptions(),
  );

  return {
    handleAddOrder: async function(productId?: string) {
      const orderUpdated = await createMutation.mutateAsync({
        timeZone: "America/Mexico_City",
        productId,
      });
      if (orderUpdated) updateCurrentOrder(orderUpdated as OrderItemsView);
    },
    handleUpdateOrderItems: async function(
      productId: string,
      type: "INSERT" | "DELETE",
    ) {
      if (!currentOrder) return;
      const orderUpdated = await updateItemMutation.mutateAsync({
        orderId: currentOrder.id,
        productId,
        type,
      });
      if (orderUpdated) updateCurrentOrder(orderUpdated as OrderItemsView);
    },
  };
}
