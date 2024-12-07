import React from 'react'
import ProductOrderManagment from '@/components/ProductOrderManagment'
import { getProducts } from '@/lib/sql/functions/getProducts';
import { getOrders } from '@/lib/sql/functions/getOrders';
import { OrderItemsProductsProvider } from '@/context/useOrderItemsProducts';
import { OrdersProvider } from '@/context/useOrders';
import { ProductProvider } from '@/context/useProducts';

export default async function Page() {
  const products = await getProducts();
  const ordersQuery = {
    isClosed: false
  }

  return (
    <OrdersProvider query={ordersQuery}>
      <ProductProvider products={products}>
        <OrderItemsProductsProvider>
          <ProductOrderManagment />
        </OrderItemsProductsProvider>
      </ProductProvider>
    </OrdersProvider>
  )
}