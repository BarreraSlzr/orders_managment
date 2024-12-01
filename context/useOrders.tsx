'use client'
import React, { PropsWithChildren, useContext } from 'react';
import { useOrders as useHook } from '@/hooks/useOrders';
import { Order, OrderContextType, Product, ProductContextType } from '@/lib/types';

type GlobalContext = ProductContextType & OrderContextType
const OrderContext = React.createContext<GlobalContext>(undefined as unknown as GlobalContext);

export const OrderProvider = ({ products, orders, children }: PropsWithChildren<{ products: Product[], orders: Order[] }>) => {
    return <OrderContext.Provider value={useHook({ products, orders })}>{children}</OrderContext.Provider>;
};


export const useOrders = () => useContext(OrderContext);