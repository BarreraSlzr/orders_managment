import React from 'react'
import { getProducts } from '@/lib/sql/functions/getProducts';
import ProductManagment from '@/components/ProductManagment';
import { ProductProvider } from '@/context/useProducts';

export default async function Page() {
  const products = await getProducts();
  return (
    <ProductProvider products={products}>
      <ProductManagment />    
    </ProductProvider>
  )
}