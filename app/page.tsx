import React from 'react'
import ProductOrderManagment from '@/components/ProductOrderManagment'
import { getProducts } from '@/lib/sql/functions/getProducts';
import { getOpenOrders } from '@/lib/sql/functions/getOpenOrders';

export default async function Page() {
  const products = await getProducts();
  const orders = await getOpenOrders("America/Mexico_City");
  return (
    <ProductOrderManagment products={products} orders={orders} />    
  )
}