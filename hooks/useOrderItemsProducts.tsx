"use client";
import { useAdminDefaults } from "@/context/useAdminDefaults";
import { useOrders } from "@/context/useOrders";
import { OrderItemsView } from "@/lib/sql/types";
import { useTRPC } from "@/lib/trpc/react";
import { OrderItemsContextActions } from "@/lib/types";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

function toUserMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "No tienes acceso a esta funcionalidad con tu plan actual.";
}

export function useOrderItemsProducts(): OrderItemsContextActions {
  const trpc = useTRPC();
  const { currentOrder, updateCurrentOrder } = useOrders();
  const { defaults } = useAdminDefaults();

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
        // Apply admin defaults for new orders
        defaultPaymentOptionId: defaults?.defaultPaymentOptionId ?? 1,
        defaultIsTakeaway: defaults?.defaultIsTakeaway ?? false,
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
      try {
        const orderUpdated = await toggleExtraMutation.mutateAsync({
          orderItemId: params.orderItemId,
          extraId: params.extraId,
          orderId: currentOrder.id,
        });
        if (orderUpdated) updateCurrentOrder(orderUpdated as OrderItemsView);
      } catch (error) {
        toast.error(toUserMessage(error));
      }
    },
  };
}
