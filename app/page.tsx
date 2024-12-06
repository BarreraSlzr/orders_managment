import React from 'react'
import ProductOrderManagment from '@/components/ProductOrderManagment'
import { getProducts } from '@/lib/sql/functions/getProducts';
import { getOpenOrders } from '@/lib/sql/functions/getOpenOrders';
import { OrderItemsProductsProvider } from '@/context/useOrderItemsProducts';
import { OrdersProvider } from '@/context/useOrders';
import { ProductProvider } from '@/context/useProducts';

export default async function Page() {
  const products = await getProducts();
  const orders = await getOpenOrders("America/Mexico_City");
  return (
    <OrdersProvider orders={orders}>
      <ProductProvider products={products}>
        <OrderItemsProductsProvider>
          <ProductOrderManagment />
        </OrderItemsProductsProvider>
      </ProductProvider>
    </OrdersProvider>


  )
}