import React from 'react'
import { getOrders } from '@/lib/sql/functions/getOpenOrders';
import OrderHistoryPage from '@/components/OrderHistory';
import { OrdersProvider } from '@/context/useOrders';

export default async function Page() {
  const orders = await getOrders();

  return (
    <OrdersProvider orders={orders}>
        <OrderHistoryPage orders={orders}/>    
    </OrdersProvider>
  )
}