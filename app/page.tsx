import React from 'react'
import ProductOrderManagment from '@/components/ProductOrderManagment'
import { getProducts } from '@/lib/sql/functions/getProducts';
import { OrderItemsProductsProvider } from '@/context/useOrderItemsProducts';
import { OrdersProvider } from '@/context/useOrders';
import { ProductProvider } from '@/context/useProducts';
import { OrdersQuery } from '@/lib/types';
import { ProductsFilterProvider } from '@/context/useProductsFilter';

export default async function Page() {
  const products = await getProducts();
  const ordersQuery: OrdersQuery = {
    isClosed: false
  };

  return (
    <OrdersProvider query={ordersQuery}>
      <ProductProvider products={products}>
        <ProductsFilterProvider>
          <OrderItemsProductsProvider>
            <ProductOrderManagment />
          </OrderItemsProductsProvider>
        </ProductsFilterProvider>
      </ProductProvider>
    </OrdersProvider>
  )
}