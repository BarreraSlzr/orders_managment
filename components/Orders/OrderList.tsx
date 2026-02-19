"use client";

import { OrderSummary } from "@/components/OrderSummary";
import { useOrders } from "@/context/useOrders";
import { useOnLongPress } from "@/hooks/useOnLongPress";
import { TEST_IDS, tid } from "@/lib/testIds";
import { Order } from "@/lib/types";
import EmptyOrders from "./EmptyState";

export default function OrdersList() {
  const {
    orders,
    currentOrder,
    selectedOrderIds,
    selectSingleOrder,
    toggleOrderSelection,
  } = useOrders();
  const { startPress, endPress, didFire } = useOnLongPress();

  const isMultiSelect = selectedOrderIds.length > 0;

  function handleRowClick(order: Order | null) {
    // Suppress click that fires immediately after a long-press gesture
    if (didFire.current) {
      didFire.current = false;
      return;
    }
    if (!order) return;
    // Normal tap: set this as the only selected order (detail view)
    // Long-press (handled separately) adds to multi-select
    selectSingleOrder(order.id);
  }

  return (
    <div
      className="flex flex-col gap-2 p-4"
      data-testid={TEST_IDS.ORDER_LIST.CONTAINER}
    >
      {Array.from(orders.values()).map((order) => {
        const isSelected = selectedOrderIds.includes(order.id);
        const isCurrent = !isMultiSelect && currentOrder?.id === order.id;
        return (
          <div
            key={order.id}
            data-testid={tid(TEST_IDS.ORDER_LIST.ROW, order.id)}
            className={[
              "border-2 rounded-lg p-4 cursor-pointer touch-auto transition-all select-none",
              isSelected
                ? "border-blue-500 bg-blue-50 shadow-sm"
                : isCurrent
                  ? "border-transparent bg-blue-100"
                  : "border-transparent hover:bg-gray-50 hover:shadow-md",
            ].join(" ")}
            onClick={() => handleRowClick(order)}
            onMouseDown={startPress(() => toggleOrderSelection(order.id))}
            onMouseUp={endPress}
            onMouseLeave={endPress}
            onTouchStart={startPress(() => toggleOrderSelection(order.id))}
            onTouchEnd={endPress}
          >
            <OrderSummary order={order} />
          </div>
        );
      })}
      {orders.size === 0 && (
        <EmptyOrders data-testid={TEST_IDS.ORDER_LIST.EMPTY} />
      )}
    </div>
  );
}

