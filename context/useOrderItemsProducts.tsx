'use client'
import React, { PropsWithChildren, useContext } from 'react';
import { useOrderItemsProducts as useHook } from '@/hooks/useOrderItemsProducts';
import { OrderItemsContextActions} from '@/lib/types';

type ContextType = OrderItemsContextActions;
const Context = React.createContext<ContextType>(undefined as unknown as ContextType);

export const OrderItemsProductsProvider = ({children }: PropsWithChildren) => {
    return <Context.Provider value={useHook()}>{children}</Context.Provider>;
};


export const useOrderItemsProducts = () => useContext(Context);