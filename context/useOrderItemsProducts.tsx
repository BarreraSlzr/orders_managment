'use client'
import React, { PropsWithChildren, useContext } from 'react';
import { useOrderItemsProducts as useHook } from '@/hooks/useOrderItemsProducts';
import { OrderContextType} from '@/lib/types';

const OrderContext = React.createContext<OrderContextType>(undefined as unknown as OrderContextType);

export const OrderItemsProductsProvider = ({children }: PropsWithChildren) => {
    return <OrderContext.Provider value={useHook()}>{children}</OrderContext.Provider>;
};


export const useOrderItemsProducts = () => useContext(OrderContext);