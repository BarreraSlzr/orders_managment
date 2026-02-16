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
  const toggleExtraMutation = useMutation(
    trpc.extras.toggleOnItem.mutationOptions(),
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
    handleToggleExtra: async function(params: {
      orderItemId: number;
      extraId: string;
    }) {
      if (!currentOrder) return;
      const orderUpdated = await toggleExtraMutation.mutateAsync({
        orderItemId: params.orderItemId,
        extraId: params.extraId,
        orderId: currentOrder.id,
      });
      if (orderUpdated) updateCurrentOrder(orderUpdated as OrderItemsView);
    },
  };
}
