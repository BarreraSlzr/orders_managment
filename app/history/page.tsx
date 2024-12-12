import React from 'react'
import OrderHistoryPage from '@/components/Orders/OrderHistory';
import { OrdersProvider } from '@/context/useOrders';

export default async function Page() {

  return (
    <OrdersProvider query={{status: ''}}>
        <OrderHistoryPage/>    
    </OrdersProvider>
  )
}