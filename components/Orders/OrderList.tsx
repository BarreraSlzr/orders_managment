"use client";

import { useOrders } from "@/context/useOrders";
import { useOnLongPress } from "@/hooks/useOnLongPress";
import { OrderItemsView } from "@/lib/sql/types";
import { TEST_IDS, tid } from "@/lib/testIds";
import { useTRPC } from "@/lib/trpc/react";
import { Order } from "@/lib/types";
import { formatPrice } from "@/lib/utils/formatPrice";
import { useQuery } from "@tanstack/react-query";
import EmptyOrders from "./EmptyState";

export default function OrdersList() {
  const {
    orders,
    currentOrder,
    selectedOrderIds,
    selectSingleOrder,
    toggleOrderSelection,
  } = useOrders();
  const { startPress, endPress, movePress, didFire } = useOnLongPress();
  const trpc = useTRPC();

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
      className="flex flex-col gap-2 p-3"
      data-testid={TEST_IDS.ORDER_LIST.CONTAINER}
    >
      {Array.from(orders.values()).map((order) => {
        const isSelected = selectedOrderIds.includes(order.id);
        const isCurrent = !isMultiSelect && currentOrder?.id === order.id;
        return (
          <OrderRow
            key={order.id}
            order={order}
            isSelected={isSelected}
            isCurrent={isCurrent}
            onClick={() => handleRowClick(order)}
            onLongPress={() => toggleOrderSelection(order.id)}
            startPress={startPress}
            endPress={endPress}
            movePress={movePress}
            trpc={trpc}
          />
        );
      })}
      {orders.size === 0 && (
        <EmptyOrders data-testid={TEST_IDS.ORDER_LIST.EMPTY} />
      )}
    </div>
  );
}

function getAggregatedPaymentIcons(items?: OrderItemsView["products"]): string {
  if (!items) return "";
  const ids = new Set(
    items.flatMap((product) =>
      product.items.map((item) => item.payment_option_id),
    ),
  );
  const parts: string[] = [];
  if (ids.has(1)) parts.push("💵");
  const hasNonCash = Array.from(ids).some((id) => id >= 2);
  if (hasNonCash) parts.push("💳");
  if (ids.has(2)) parts.push("💸");
  if (ids.has(5)) parts.push("📱");
  if (ids.has(6)) parts.push("🟠");
  return parts.join("");
}

function OrderRow(props: {
  order: Order;
  isSelected: boolean;
  isCurrent: boolean;
  onClick: () => void;
  onLongPress: () => void;
  startPress: ReturnType<typeof useOnLongPress>["startPress"];
  endPress: ReturnType<typeof useOnLongPress>["endPress"];
  movePress: ReturnType<typeof useOnLongPress>["movePress"];
  trpc: ReturnType<typeof useTRPC>;
}) {
  const {
    order,
    isSelected,
    isCurrent,
    onClick,
    onLongPress,
    startPress,
    endPress,
    movePress,
    trpc,
  } = props;
  const detailsQuery = useQuery(
    trpc.orders.getDetails.queryOptions({ id: order.id }),
  );
  const paymentIcons = getAggregatedPaymentIcons(detailsQuery.data?.products);
  const createdLabel = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(order.created));

  return (
    <div
      data-testid={tid(TEST_IDS.ORDER_LIST.ROW, order.id)}
      className={[
        "border rounded-lg px-3 py-2 cursor-pointer touch-auto transition-all select-none",
        isSelected
          ? "border-amber-400 bg-amber-50 shadow-sm"
          : isCurrent
          ? "border-transparent bg-slate-100"
          : "border-slate-200 hover:bg-slate-50",
      ].join(" ")}
      onClick={onClick}
      onMouseDown={startPress(onLongPress)}
      onMouseUp={endPress}
      onMouseLeave={endPress}
      onMouseMove={movePress}
      onTouchStart={startPress(onLongPress)}
      onTouchEnd={endPress}
      onTouchMove={movePress}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-600">
            ORDEN #{order.position}-{order.id.slice(0, 4).toUpperCase()}
          </span>
          <span className="text-[11px] text-slate-500">{createdLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-700">{paymentIcons}</span>
          <span className="text-xs font-mono text-slate-900">
            {formatPrice(order.total)}
          </span>
        </div>
      </div>
    </div>
  );
}
