"use client";

import { ReactNode } from "react";

interface RegionProps {
  children: ReactNode;
}

function OrdersSheetLayoutRoot({ children }: RegionProps) {
  return <div className="flex flex-col flex-1 min-h-0 h-full">{children}</div>;
}

function OrdersSheetLayoutTop({ children }: RegionProps) {
  return <div className="shrink-0 sticky top-0 z-30 bg-white">{children}</div>;
}

function OrdersSheetLayoutList({ children }: RegionProps) {
  return (
    <div className="relative z-0 flex-1 min-h-[84px] overflow-auto overscroll-contain touch-pan-y">
      {children}
    </div>
  );
}

function OrdersSheetLayoutBottom({ children }: RegionProps) {
  return <div className="shrink-0 sticky bottom-0 z-50">{children}</div>;
}

export const OrdersSheetLayout = Object.assign(OrdersSheetLayoutRoot, {
  Top: OrdersSheetLayoutTop,
  List: OrdersSheetLayoutList,
  Bottom: OrdersSheetLayoutBottom,
});
