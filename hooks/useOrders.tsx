'use client'
import { handleCloseOrder,  handleRemoveProducts,  handleSelectOrderItems, handleSplitOrder, handleToggleTakeAway, handleUpdatePayment } from '@/app/actions';
import { OrdersQuery, Order, OrderContextActions, OrderContextState, OrderItems, OrderItemsFE } from '@/lib/types';
import { useCallback, useEffect, useState, useTransition } from 'react';

export interface initOrdersProps {
  orders?: Order[]
  query?: OrdersQuery
}

export function useOrders({ orders: os = [], query: initialQuery = {}}: initOrdersProps): OrderContextState & OrderContextActions {
  const [isPending, startTransition] = useTransition();
  const [orders, setOrders] = useState(new Map<Order['id'], Order>(os.map(o => [o.id, o])));
  const [currentOrder, setCurrentOrder] = useState<OrderItemsFE | null>(null);
  const [query, setQuery] = useState<OrdersQuery>(initialQuery);

  // Fetching orders
  const fetchOrders = async (updatedQuery: Partial<OrdersQuery> = {}) => {
    const newQuery = { ...query, ...updatedQuery };
    setQuery(newQuery);

    const queryParams = new URLSearchParams(newQuery as Record<string, string>).toString();
    const response = await fetch(`/api/orders?${queryParams}`);
    if (!response.ok) throw new Error('Failed to fetch orders');

    const fetchedOrders = await response.json() as Order[];
    startTransition(() => {
      setOrders(new Map(fetchedOrders.map(o => [o.id, o])));
    });
  };

  useEffect(() => {
    const closeHandler = () => setCurrentOrder(null);
    window.addEventListener("close-order-details", closeHandler);
    fetchOrders();
    return () => window.removeEventListener("close-order-details", closeHandler);
  }, [])

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

  return {
    isPending,
    currentOrder,
    orders,
    startTransition,
    setCurrentOrder,
    setOrders,
    updateCurrentOrder: updateOrder,
    fetchOrders,
    async handleUpdateItemDetails(actionType, formData) {
      if( actionType === 'remove'){
        return  await handleRemoveProducts(formData).then((result) => {
          if( result.success && currentOrder){
            const itemIds = new Set(formData.getAll('item_id').map(Number));
            currentOrder.items.forEach((order) => {
              order.items = order.items.filter(({id}) => !itemIds.has(id));
              if( order.items.length === 0){
                currentOrder.items.delete(order.product_id)
              } 
            });
            setCurrentOrder({...currentOrder});
          }
          return result.success;
      });
      }
      const update = () => {
          switch(actionType){
            case 'toggleTakeAway': return handleToggleTakeAway(formData);
            case 'updatePayment': return handleUpdatePayment(formData);
        }
      } 
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