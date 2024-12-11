'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Product, ProductContextType } from '@/lib/types';
import { Updateable } from 'kysely';
import { handleUpsertProduct as serverUpsertProduct } from '@/app/actions';

const defaultProduct: Updateable<Product> = {
  id: '', // Temporary empty ID until the product is saved
  name: '',
  price: 0,
  tags: '',
};

export function useProducts({ products: defaultProducts }: { products: Product[] }): ProductContextType {
  const { data: productsData, error, isValidating } = useSWR<Product[]>('/api/products', {
    fetcher: (url) => fetch(url).then((res) => res.json()),
      fallbackData: defaultProducts,
    revalidateOnFocus: false,
  });

  const [currentProduct, setCurrentProduct] = useState<Updateable<Product>>({ ...defaultProduct });

  const productsMap = useMemo(() => {
    return new Map(productsData?.map((p) => [p.id, p]) ?? []);
  }, [productsData]);

  const handleEditProduct = (product: Updateable<Product> = { ...defaultProduct }) => {
    setCurrentProduct({ ...product });
  };

  const handleUpsertProduct = async (formData: FormData) => {
    const response = await serverUpsertProduct(formData);
    if (!response.success) throw new Error('Failed to upsert product');
    const updatedProduct = response.result.product as Product;

    // Update the cache
    mutate('/api/products', (products: Product[] = []) => {
      const existingIndex = products.findIndex((p) => p.id === updatedProduct.id);
      if (existingIndex > -1) {
        products[existingIndex] = updatedProduct;
      } else {
        products.push(updatedProduct);
      }
      return [...products];
    }, false);

    // Ensure current product matches the updated product if editing it
    if (currentProduct?.id === updatedProduct.id) {
      setCurrentProduct({ ...updatedProduct });
    }
  };

  const handleDeleteProduct = async (formData: FormData) => {
    const response = await fetch(`/api/products`, {
      method: 'DELETE',
      body: formData,
    });

    if (!response.ok) throw new Error('Failed to delete product');
    const { id: deletedProductId } = await response.json();

    // Update the cache
    mutate('/api/products', (products: Product[] = []) => {
      return products.filter((p) => p.id !== deletedProductId);
    }, false);

    // Reset current product if it was the deleted product
    if (currentProduct?.id === deletedProductId) {
      setCurrentProduct({ ...defaultProduct });
    }
  };

  return {
    products: productsMap,
    currentProduct,
    handleEditProduct,
    handleUpsertProduct,
    handleDeleteProduct,
  };
};
