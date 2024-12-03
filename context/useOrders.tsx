'use client'
import React, { PropsWithChildren, useContext } from 'react';
import { useOrders as useHook } from '@/hooks/useOrders';
import { Order, OrderContextType, Product } from '@/lib/types';

const OrderContext = React.createContext<OrderContextType>(undefined as unknown as OrderContextType);

export const OrderProvider = ({ products, orders, children }: PropsWithChildren<{ products: Product[], orders: Order[] }>) => {
    return <OrderContext.Provider value={useHook({ products, orders })}>{children}</OrderContext.Provider>;
};


export const useOrders = () => useContext(OrderContext);