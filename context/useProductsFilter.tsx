'use client'
import React, { PropsWithChildren, useContext } from 'react';
import { useProductsFilter as useHook } from '@/hooks/useProductFilters';
import { ProductFilterContextActions, ProductFilterContextState} from '@/lib/types';

type ContextType = ProductFilterContextActions & ProductFilterContextState
const ProductsFilterContext = React.createContext<ContextType>(undefined as unknown as ContextType);

export const ProductsFilterProvider = ({children }: PropsWithChildren) => {
    return <ProductsFilterContext.Provider value={useHook()}>{children}</ProductsFilterContext.Provider>;
};


export const useProductsFilter = () => useContext(ProductsFilterContext);