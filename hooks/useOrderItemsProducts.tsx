'use client'
import { handleInsertOrder, handleUpdateOrderItem } from '@/app/actions';
import { useOrders } from '@/context/useOrders';
import { OrderItemsContextActions } from '@/lib/types';

export function useOrderItemsProducts(): OrderItemsContextActions {
  const {
    currentOrder,
    startTransition,
    updateCurrentOrder,
  } = useOrders();

  return {
    handleAddOrder: async function (productId?: string) {
      const formData = new FormData()
      if (productId) formData.append('productId', productId)
      const { message, success, result: orderUpdated } = await handleInsertOrder(formData);
      startTransition(async () => {
        if (success) updateCurrentOrder(orderUpdated);
      })
    },
    handleUpdateOrderItems: async function (productId: string, type: "INSERT" | "DELETE") {
      // Update order items logic
      if (!currentOrder) return
      const formData = new FormData()
      formData.append('orderId', currentOrder.order.id)
      formData.append('productId', productId)
      formData.append('type', type)
      const { success, result: orderUpdated } = await handleUpdateOrderItem(formData);

      startTransition(async () => {
        if (success) updateCurrentOrder(orderUpdated)
      })
    }
  }
}