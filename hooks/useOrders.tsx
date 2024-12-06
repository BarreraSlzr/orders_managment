'use client'
import { handleCloseOrder,  handleSelectOrderItems, handleSplitOrder, handleToggleTakeAway, handleUpdatePayment } from '@/app/actions';
import { Order, OrderContextActions, OrderContextState, OrderItems, OrderItemsFE } from '@/lib/types';
import { useCallback, useEffect, useState, useTransition } from 'react';

export function useOrders({ orders: os }: {
  orders: Order[]
}): OrderContextState & OrderContextActions {
  const [isPending, startTransition] = useTransition();
  const [orders, setOrders] = useState(new Map<Order['id'], Order>(os.map(o => [o.id, o])));
  const [currentOrder, setCurrentOrder] = useState<OrderItemsFE | null>(null);

  const updateOrder = useCallback(function (value: OrderItems | null) {
    try {
      if (value !== null) {
        orders.set(value.order.id, value.order);
        setOrders(new Map(orders));
        setCurrentOrder({
          ...{
            order: value.order,
            items: new Map(value.items.map(it => [it.product_id, it]))
          }
        })
      } else {
        setCurrentOrder(null);
      }
    } catch (error) {
      console.log({ orderUpdate: { error } });
    } finally {
      console.log({ orderUpdate: value })
    }
  }, [orders])

  // Fetching orders
  const fetchOrders = async () => {
    const response = await fetch('/api/orders')
    if (!response.ok) throw new Error('Failed to fetch open orders')
    return response.json() as unknown as Order[]
  }

  useEffect(() => {
    async function fetchAll() {
      const orders = await fetchOrders()
      startTransition(() => {
        setOrders(new Map(orders.map(o => [o.id, o])))
      })
    }
    fetchAll();
  }, [])

  return {
    isPending,
    currentOrder,
    orders,
    startTransition,
    setCurrentOrder,
    setOrders,
    updateCurrentOrder: updateOrder,
    async handleUpdateItemDetails(actionType, formData) {
      const update = () => actionType === 'toggleTakeAway'
        ? handleToggleTakeAway(formData)
        : handleUpdatePayment(formData);
      const result = await update();
      if (result.success){
        if(currentOrder){
          const newItemDetails = new Map((result.result.map(({product_id, ...item}) => [item.id, item])))
          const productsInvolved = new Set((result.result.map(({product_id}) => product_id)))
          Array.from(productsInvolved.values()).map((product_id) => {
            const product = currentOrder.items.get(product_id);
            if( product ){
              currentOrder.items.set(product_id, {...product, items: product.items.map(it => newItemDetails.get(it.id) || it)})
            }
          })
          setCurrentOrder({...currentOrder});
        }
      }
      return result.success;
    },
    handleSplitOrder: async function (formData: FormData) {
      const updatedOrder = await handleSplitOrder(formData);
      if (updatedOrder.success) {
        startTransition(() => {
          orders.set(updatedOrder.result.oldOrder.id, updatedOrder.result.oldOrder);
          orders.set(updatedOrder.result.newOrder.id, updatedOrder.result.newOrder);
          setOrders(new Map(orders));
          setCurrentOrder({
            order: updatedOrder.result.newOrder,
            items: new Map(updatedOrder.result.items.map(it => [it.product_id, it]))
          });
        })
      }
      return updatedOrder.success
    },
    handleCloseOrder: async function () {
      // Close order logic
      if (!currentOrder) return
      const formData = new FormData()
      formData.append('orderId', currentOrder.order.id)
      const { success } = await handleCloseOrder(formData)

      startTransition(async () => {
        if (success) {
          orders.delete(currentOrder.order.id);
          setOrders(new Map(orders));
        }
        updateOrder(null)
      })
    },
    setCurrentOrderDetails: async function (order: Order | null) {
      // Set current order logic
      if (!order) {
        updateOrder(null);
        return void 0;
      }
      const formData = new FormData()
      formData.append('orderId', order.id)
      const { success, result: orderUpdated } = await handleSelectOrderItems(formData);
      startTransition(async () => {
        if (success) updateOrder(orderUpdated)
      })
    },
  }
}