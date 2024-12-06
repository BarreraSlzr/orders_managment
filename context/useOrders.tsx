'use client'
import React, { PropsWithChildren, useContext } from 'react';
import { useOrders as useHook } from '@/hooks/useOrders';
import { Order, OrderContextActions, OrderContextState } from '@/lib/types';

const OrderContext = React.createContext<OrderContextState & OrderContextActions>(undefined as unknown as OrderContextState & OrderContextActions);

export const OrdersProvider = ({ orders, children }: PropsWithChildren<{ orders: Order[] }>) => {
    return <OrderContext.Provider value={useHook({ orders })}>{children}</OrderContext.Provider>;
};


export const useOrders = () => useContext(OrderContext);