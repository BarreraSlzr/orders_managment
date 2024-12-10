'use client';

import { useEffect, useState, useTransition } from 'react';
import useSWR from 'swr';
import { handleCloseOrder, handleRemoveProducts, handleSplitOrder, handleToggleTakeAway, handleUpdatePayment } from '@/app/actions';
import { OrdersQuery, Order, OrderContextState, OrderContextActions } from '@/lib/types';
import { OrderItemsView } from '@/lib/sql/types';
import { useRouter } from 'next/navigation';

export interface InitOrdersProps {
  orders?: Order[];
  query?: OrdersQuery;
}

export function useOrders({ orders: initialOrders = [], query: initialQuery = {} }: InitOrdersProps): OrderContextState & OrderContextActions {
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState<OrdersQuery>(initialQuery);
  const router = useRouter();

  // Fetch `Order` data for the main `orders` list
  const { data: fetchedOrders, mutate: revalidateOrders } = useSWR<Order[]>(
    `/api/orders?${new URLSearchParams(query as Record<string, string>).toString()}`,
    { fallbackData: initialOrders,
      fetcher: (resource: any, init: any) => fetch(resource, init).then(res => res.json())
     }
  );

  // Fetch `OrderItemsView` data for `currentOrder`
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const { data: OrderItemsView, mutate: revalidateCurrentOrder} = useSWR(
    currentOrderId ? `/api/orders/${currentOrderId}` : null,{
      fetcher: (resource: any, init: any) => fetch(resource, init).then(res => res.json()),
      onSuccess: () => {
        if (currentOrderId === null) {
          revalidateCurrentOrder(null); // Reset the data when the order is null
        }
      },
    }
  );
  const [currentOrder, setCurrentOrder] = useState<OrderItemsView | null>(OrderItemsView)

  const orders = new Map(fetchedOrders?.map((order) => [order.id, order]) ?? []);

  const fetchOrders = async (updatedQuery: Partial<OrdersQuery> = {}) => {
    setQuery((prev) => ({ ...prev, ...updatedQuery }));
    await revalidateOrders();
  };

  const updateOrder = (updatedOrder: OrderItemsView | null) => {
    if (updatedOrder) {
      setCurrentOrderId(updatedOrder.id);
      if(!orders.has(updatedOrder.id)){
        revalidateOrders();
      }
    } else {
      setCurrentOrderId(null);
    }
    revalidateCurrentOrder();
  };

  useEffect(() => {
    if (currentOrderId === null) {
      setCurrentOrder(null);
    } else {
      setCurrentOrder(OrderItemsView);
    }
  }, [currentOrderId, OrderItemsView])

  useEffect(() => {
    const closeHandler = () => setCurrentOrder(null);
    window.addEventListener("close-order-details", closeHandler);
    return () => window.removeEventListener("close-order-details", closeHandler);
  }, [])

  return {
    isPending,
    orders,
    currentOrder,
    startTransition,
    fetchOrders,
    updateCurrentOrder: updateOrder,
    async handleUpdateItemDetails(actionType, formData) {
      const action = async () => {
        switch (actionType) {
          case 'remove':
            return (await handleRemoveProducts(formData)).success;
          case 'toggleTakeAway':
            return (await handleToggleTakeAway(formData)).success;
          case 'updatePayment':
            return (await handleUpdatePayment(formData)).success;
          default:
            throw new Error(`Unknown action type: ${actionType}`);
        }
      };

      const success = await action();
      if (success) {
        await revalidateCurrentOrder();
        await revalidateOrders();
      }
      return success;
    },
    async handleSplitOrder(formData: FormData) {
      const result = await handleSplitOrder(formData);
      if (result.success) {
        startTransition(() => {
          const {products: items, ...newOrder} = result.result.newOrder;
          orders.set(result.result.oldOrder.id, result.result.oldOrder);
          orders.set(newOrder.id, newOrder);
          updateOrder(result.result.newOrder);
        });
      }
      return result.success;
    },
    async handleCloseOrder() {
      if (!currentOrder) return false;
      const formData = new FormData();
      formData.append('orderId', currentOrder.id.toString());
      setCurrentOrder(null);
      setCurrentOrderId(null);
      const result = handleCloseOrder(formData);
      return (await result).success;
    },
    async setCurrentOrderDetails(order: Order | null) {
      if (!order) {
        setCurrentOrderId(null);
        return;
      }
      setCurrentOrderId(order.id);
      revalidateCurrentOrder();
      setCurrentOrder(OrderItemsView);
    },
  };
}
