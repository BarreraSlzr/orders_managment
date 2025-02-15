'use client'
import React, { PropsWithChildren, useContext } from 'react';
import { InitOrdersProps, useOrders as useHook } from '@/hooks/useOrders';
import { OrderContextActions, OrderContextState } from '@/lib/types';

const OrderContext = React.createContext<OrderContextState & OrderContextActions>(undefined as unknown as OrderContextState & OrderContextActions);

export const OrdersProvider = ({ orders, query, children }: PropsWithChildren<InitOrdersProps>) => {
    return <OrderContext.Provider value={useHook({ orders, query })}>{children}</OrderContext.Provider>;
};


export const useOrders = () => useContext(OrderContext);