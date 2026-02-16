"use client";
import { InitOrdersProps, useOrders as useHook } from "@/hooks/useOrders";
import { OrderContextActions, OrderContextState } from "@/lib/types";
import React, { PropsWithChildren, useContext } from "react";

const OrderContext = React.createContext<
  OrderContextState & OrderContextActions
>((undefined as unknown) as OrderContextState & OrderContextActions);

export const OrdersProvider = ({
  query,
  children,
}: PropsWithChildren<InitOrdersProps>) => {
  return (
    <OrderContext.Provider value={useHook({ query })}>
      {children}
    </OrderContext.Provider>
  );
};

export const useOrders = () => useContext(OrderContext);
