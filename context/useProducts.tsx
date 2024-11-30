'use client'
import React, { PropsWithChildren, useContext } from 'react';
import { useProducts as useHook } from '@/hooks/useProducts';
import { Product, ProductContextType } from '@/lib/types';

const ProductContext = React.createContext<ProductContextType>(undefined as unknown as ProductContextType);

export const ProductProvider = ({ products, children }: PropsWithChildren<{ products: Product[] }>) => {
    return <ProductContext.Provider value={useHook({products})}>{children}</ProductContext.Provider>;
};


export const useProducts = () => useContext(ProductContext);