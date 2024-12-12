'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { handleCloseOrder, handleRemoveProducts, handleSplitOrder, handleToggleTakeAway, handleUpdatePayment } from '@/app/actions';
import { OrdersQuery, Order, OrderContextState, OrderContextActions } from '@/lib/types';
import { OrderItemsView } from '@/lib/sql/types';

export interface InitOrdersProps {
  orders?: Order[];
  query?: OrdersQuery;
}

export function useOrders({ orders: initialOrders = [], query: initialQuery = {} }: InitOrdersProps): OrderContextState & OrderContextActions {
  const [query, setQuery] = useState<OrdersQuery>(initialQuery);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [currentOrder, setCurrentOrder] = useState<OrderItemsView | null>(null);
  
  // Fetch `OrderItemsView` data for `currentOrder`
  const { data: OrderItemsView, isLoading: isLoadingDetail, mutate: revalidateCurrentOrder } = useSWR(
    currentOrderId ? `/api/orders/${currentOrderId}` : null,
    { refreshInterval: 1000 * 60 * 5,
      fetcher: (resource: any, init: any) => fetch(resource, init).then((res) => res.json())},
  );
  // Fetch `Order` data for the main `orders` list
  const { data: fetchedOrders, isLoading, mutate: revalidateOrders } = useSWR<Order[]>(
    `/api/orders?${new URLSearchParams(query as Record<string, string>).toString()}`,
    {
      fallbackData: initialOrders,
      fetcher: (resource: any, init: any) => fetch(resource, init).then((res) => res.json()),
    }
  );

  useEffect(() => {
    if (!currentOrderId) {
      setCurrentOrder(null); // Explicitly reset currentOrder when currentOrderId is null
    } else {
      setCurrentOrder(OrderItemsView); // Sync with fetched data
    }
  }, [currentOrderId, OrderItemsView]);

  useEffect(() => {
    const closeHandler = () => setCurrentOrder(null);
    window.addEventListener('close-order-details', closeHandler);
    return () => window.removeEventListener('close-order-details', closeHandler);
  }, []);

  const orders = new Map<string, Order>(fetchedOrders?.map((order) => [order.id, order]) ?? []);

  const fetchOrders = async (updatedQuery: Partial<OrdersQuery> = {}) => {
    setQuery((prev) => ({ ...prev, ...updatedQuery }));
    await revalidateOrders();
  };

  const updateOrder = (updatedOrder: OrderItemsView | null) => {
    if (updatedOrder) {
      if (!orders.has(updatedOrder.id)) {
        revalidateOrders();
      }
      setCurrentOrderId(updatedOrder.id);
    } else {
      setCurrentOrderId(null);
    }
    revalidateCurrentOrder();
  };

  return {
    isPending: (isLoading || isLoadingDetail),
    orders,
    currentOrder,
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
          const { products: items, ...newOrder } = result.result.newOrder;
          orders.set(result.result.oldOrder.id, result.result.oldOrder);
          orders.set(newOrder.id, newOrder);
          await revalidateOrders();
          updateOrder(result.result.newOrder);
      }
      return result.success;
    },
    async handleCloseOrder(formData: FormData) {
      const result = await handleCloseOrder(formData);
      if( result.success){
        setCurrentOrder(null);
        setCurrentOrderId(null);
        await revalidateOrders();
      }
      return result.success;
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
