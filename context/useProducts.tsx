"use client";
import { useProducts as useHook } from "@/hooks/useProducts";
import { ProductContextType } from "@/lib/types";
import React, { PropsWithChildren, useContext } from "react";

const ProductContext = React.createContext<ProductContextType>(
  (undefined as unknown) as ProductContextType,
);

export const ProductProvider = ({ children }: PropsWithChildren) => {
  return (
    <ProductContext.Provider value={useHook()}>
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => useContext(ProductContext);
