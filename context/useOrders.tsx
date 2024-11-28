'use client'
import React, { useState, useMemo, useDeferredValue, useTransition, PropsWithChildren, useContext } from 'react';
import { useOrders as uO } from '@/hooks/useOrders';
import { Order, OrderContextType, Product } from '@/lib/types';

const OrderContext = React.createContext<OrderContextType>(undefined as unknown as OrderContextType);

export const OrderProvider = ({ products, orders, children }: PropsWithChildren<{ products: Product[], orders: Order[] }>) => {
    const value = uO({ products, orders });
    return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
};


export const useOrders = () => useContext(OrderContext);