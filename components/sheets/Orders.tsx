"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useOrders } from "@/context/useOrders";
import { OrderItemsView } from "@/lib/sql/types";
import { TEST_IDS } from "@/lib/testIds";
import { useTRPC } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils/formatPrice";
import { useQueries, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, ChevronLeft, Layers, ShoppingBag, X } from "lucide-react";
import { parseAsBoolean, useQueryState } from "nuqs";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import OrderStatus from "../Orders/OrderControls";
import OrderDetails from "../Orders/OrderDetails";
import OrdersList from "../Orders/OrderList";
import { OrderSummary } from "../OrderSummary";
import { Card } from "../ui/card";
import { Spinner } from "../ui/spinner";

// ── ChevronFloodButton ───────────────────────────────────────────────────────
// Measures its own width after mount so chevrons exactly fill the container.
// Slides up on appearance and centers the label with a text-shadow halo.
function ChevronFloodButton({
  onClick,
  testId,
}: {
  onClick: () => void;
  testId: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [count, setCount] = useState(12); // initial fallback until measured

  useEffect(() => {
    if (!ref.current) return;
    const measure = () => {
      const w = ref.current?.offsetWidth ?? 0;
      // each ChevronLeft icon is w-4 = 16px; +2 ensures full bleed after clip
      setCount(Math.ceil(w / 16) + 2);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return (
    <button
      ref={ref}
      onClick={onClick}
      title="Agregar más productos"
      data-testid={testId}
      className="animate-slide-up group relative w-full flex items-center overflow-hidden py-3 rounded-t-xl text-zinc-600 hover:text-zinc-300 transition-colors duration-200"
    >
      {/* Chevron flood — width-driven count, wave travels right→left */}
      <span className="flex items-center" aria-hidden>
        {Array.from({ length: count }, (_, i) => (
          <ChevronLeft
            key={i}
            className={cn(
              "h-4 w-4 shrink-0",
              i % 6 === 0 && "animate-chevron-6",
              i % 6 === 1 && "animate-chevron-5",
              i % 6 === 2 && "animate-chevron-4",
              i % 6 === 3 && "animate-chevron-3",
              i % 6 === 4 && "animate-chevron-2",
              i % 6 === 5 && "animate-chevron-1",
            )}
          />
        ))}
      </span>
      {/* Label — absolutely centered, dark blurred pill for contrast over chevrons */}
      <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-xs font-bold tracking-widest font-mono uppercase text-white px-3 rounded bg-black/60 backdrop-blur-sm shadow-[0_0_16px_8px_rgba(0,0,0,0.55)] group-hover:bg-black/80 transition-colors duration-200">
          Agregar más productos
        </span>
      </span>
    </button>
  );
}

// ── StatusMessage ────────────────────────────────────────────────────────────
// Single stable element for feedback text — avoids DOM churn between
// "nothing selected" ↔ "loading" states. Same structure, different text.
function StatusMessage({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="py-6 text-center text-xs font-bold font-mono uppercase tracking-widest text-white/60"
      data-testid={TEST_IDS.ORDER_SHEET.EMPTY_SELECTION}
    >
      {children}
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function OpenOrderSheet() {
  const {
    orders,
    currentOrder,
    selectedOrderIds,
    setCurrentOrderDetails,
    clearOrderSelection,
    handleCombineOrders,
    handleCloseMultiple,
  } = useOrders();
  const [sheetOpen, setSheetOpen] = useQueryState(
    "sheet",
    parseAsBoolean.withDefault(false),
  );
  const [filterStatus, setFilterStatus] = useState("opened");
  const [selectedDate, setSelectedDate] = useState<string | undefined>(
    undefined,
  );
  const trpc = useTRPC();
  const openOrdersQuery = useQuery(
    trpc.orders.list.queryOptions({
      status: "opened",
      timeZone: "America/Mexico_City",
      date: selectedDate,
    }),
  );
  const closedOrdersQuery = useQuery(
    trpc.orders.list.queryOptions({
      status: "closed",
      timeZone: "America/Mexico_City",
      date: selectedDate,
    }),
  );
  const openCount = openOrdersQuery.data?.length ?? 0;
  const closedCount = closedOrdersQuery.data?.length ?? 0;
  const totalCount = openCount + closedCount;
  const selectedOrderIdSet = useMemo(() => new Set(selectedOrderIds), [
    selectedOrderIds,
  ]);
  const summaryOrders = useMemo(() => {
    const all = Array.from(orders.values());
    if (selectedOrderIds.length > 1) {
      return all.filter((order) => selectedOrderIdSet.has(order.id));
    }
    return all;
  }, [orders, selectedOrderIdSet, selectedOrderIds.length]);
  const dayTotal = summaryOrders.reduce((sum, order) => sum + order.total, 0);
  const ordersArray = summaryOrders;
  const detailsQueries = useQueries({
    queries: ordersArray.map((order) =>
      trpc.orders.getDetails.queryOptions({ id: order.id }),
    ),
  });
  const detailsData = detailsQueries
    .map((query) => query.data)
    .filter(Boolean) as OrderItemsView[];
  const isPaymentSummaryLoading = detailsQueries.some(
    (query) => query.isLoading,
  );

  const paymentSummary = useMemo(() => {
    const totals = new Map<number, { total: number; count: number }>();

    for (const order of detailsData) {
      for (const product of order.products) {
        for (const item of product.items) {
          if (!item.payment_option_id) continue;
          const extrasTotal = item.extras.reduce(
            (sum, extra) => sum + extra.price,
            0,
          );
          const amount = product.price + extrasTotal;
          const current = totals.get(item.payment_option_id) ?? {
            total: 0,
            count: 0,
          };
          totals.set(item.payment_option_id, {
            total: current.total + amount,
            count: current.count + 1,
          });
        }
      }
    }

    return [
      { id: 1, label: "Efectivo", icon: "💵" },
      { id: 2, label: "Transferencia", icon: "💳💸" },
      { id: 3, label: "Credito", icon: "💳" },
      { id: 4, label: "Debito", icon: "💳" },
      { id: 5, label: "Movil", icon: "💳📱" },
      { id: 6, label: "Crypto", icon: "💳🟠" },
    ]
      .map((option) => ({
        ...option,
        totals: totals.get(option.id) ?? { total: 0, count: 0 },
      }))
      .filter((option) => option.totals.count > 0);
  }, [detailsData]);

  // Auto-switch to "closed" tab when viewing a closed order
  useEffect(() => {
    if (currentOrder?.closed) {
      setFilterStatus("closed");
    }
  }, [currentOrder?.closed]);

  useEffect(() => {
    if (sheetOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sheetOpen]);

  function handleClose() {
    void setSheetOpen(false);
    void setCurrentOrderDetails(null);
  }

  const isMultiSelect = selectedOrderIds.length > 1;
  const multiSelectLabel =
    selectedOrderIds.length > 0 ? `(${selectedOrderIds.length}) ORDENES` : null;

  return (
    <Sheet
      open={sheetOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
        else void setSheetOpen(true);
      }}
    >
      {/* Trigger area — plain div, not SheetTrigger, so open state is fully controlled */}
      <div
        className="ms-auto flex flex-wrap gap-2"
        data-testid={TEST_IDS.ORDER_SHEET.TRIGGER}
      >
        {currentOrder && (
          <Button
            variant={"default"}
            className="h-16 rounded-full relative px-8 flex-grow"
            onClick={() => void setSheetOpen(true)}
            data-testid={TEST_IDS.ORDER_SHEET.ACTIVE_ORDER_BADGE}
          >
            <OrderSummary order={currentOrder} minimal />
          </Button>
        )}
        <Button
          className="relative h-16 w-16 rounded-full ms-auto"
          onClick={() => void setSheetOpen(true)}
        >
          <ShoppingBag className="!h-6 !w-6 text-primary-foreground" />
          <span
            className="absolute -right-2 -top-2 flex flex-col gap-1"
            data-testid={TEST_IDS.ORDER_SHEET.COUNT_BADGE}
          >
            {openCount > 0 && (
              <span className="h-5 min-w-[1.25rem] rounded-full bg-amber-400 text-black text-[10px] font-bold flex items-center justify-center px-1">
                {openCount}
              </span>
            )}
            {closedCount > 0 && (
              <span className="h-5 min-w-[1.25rem] rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center px-1">
                {closedCount}
              </span>
            )}
          </span>
        </Button>
      </div>
      <SheetContent
        className="flex w-full h-full flex-col sm:max-w-lg p-0 pt-4"
        data-testid={TEST_IDS.ORDER_SHEET.ROOT}
      >
        <SheetHeader className="flex flex-row gap-2 justify-between items-center p-0">
          <SheetTitle
            className="text-center text-xl font-bold px-3 cursor-pointer"
            onClick={handleClose}
          >
            {multiSelectLabel ?? "ORDENES"}
          </SheetTitle>
          <div className="px-3 pr-10">
            <OrderStatus
              defaultStatus="opened"
              value={filterStatus}
              onValueChange={setFilterStatus}
              openCount={openCount}
              closedCount={closedCount}
              totalCount={totalCount}
              date={selectedDate}
            />
          </div>
        </SheetHeader>
        {/* Date picker row */}
        <div className="px-3 pt-1 flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="date"
              value={selectedDate ?? ""}
              onChange={(e) => setSelectedDate(e.target.value || undefined)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 pl-8 text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>
          {selectedDate && (
            <button
              onClick={() => setSelectedDate(undefined)}
              className="text-[10px] font-mono uppercase tracking-wide text-slate-500 hover:text-slate-800 transition-colors px-1.5 py-1 rounded border border-slate-200"
            >
              Hoy
            </button>
          )}
          <span className="text-[11px] font-mono text-slate-500">
            {format(
              selectedDate ? new Date(selectedDate + "T12:00:00") : new Date(),
              "EEE dd MMM",
              { locale: es },
            )}
          </span>
        </div>
        <div className="px-3 pt-2">
          <Card className="border-slate-300 bg-white font-mono">
            <div className="px-3 py-2 text-[11px] uppercase tracking-widest text-slate-500 border-b border-dashed border-slate-300 flex items-center justify-between">
              <span>
                Resumen del día (
                {filterStatus === "all"
                  ? "Todas"
                  : filterStatus === "opened"
                  ? "Abiertas"
                  : "Cerradas"}
                )
              </span>
              <span>
                {summaryOrders.length} orden
                {summaryOrders.length === 1 ? "" : "es"}
              </span>
            </div>
            <div className="px-3 py-2 text-xs flex items-center justify-between">
              <span className="uppercase tracking-wide text-slate-500">
                Total
              </span>
              <span className="text-sm font-bold tabular-nums text-slate-900">
                {formatPrice(dayTotal)}
              </span>
            </div>
            <div className="px-3 pb-3 flex flex-col gap-1.5">
              {isPaymentSummaryLoading ? (
                <span className="text-xs text-slate-500 uppercase tracking-wide">
                  Calculando pagos...
                </span>
              ) : paymentSummary.length === 0 ? (
                <span className="text-xs text-slate-500 uppercase tracking-wide">
                  Sin pagos registrados
                </span>
              ) : (
                paymentSummary.map((option) => (
                  <div
                    key={option.id}
                    className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px]"
                  >
                    <span>{option.icon}</span>
                    <span className="uppercase tracking-wide text-slate-700">
                      {option.label}
                    </span>
                    <span className="text-slate-500 tabular-nums">
                      x{option.totals.count}
                    </span>
                    <span className="font-semibold tabular-nums text-slate-900">
                      {formatPrice(option.totals.total)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
        <div className="flex flex-col flex-1 min-h-0">
          {/* Orders List — scrollable region */}
          <div className="flex-1 overflow-auto overscroll-contain touch-pan-y">
            <Suspense fallback={<Spinner className="mx-auto" />}>
              <OrdersList />
            </Suspense>
          </div>

          {/* Selected Order Details — always pinned at bottom, outside scroll */}
          <Card className="flex flex-col shrink-0 bg-black border-zinc-800 text-white">
            {isMultiSelect ? (
              /* ── Multi-select bulk actions ─────────────────── */
              <div
                className="flex flex-col gap-2 p-4"
                data-testid={TEST_IDS.ORDER_LIST.MULTI_ACTIONS_PANEL}
              >
                <p className="text-sm text-center text-white/60">
                  {selectedOrderIds.length} órdenes seleccionadas
                </p>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    variant="default"
                    onClick={async () => {
                      await handleCombineOrders();
                    }}
                    data-testid={TEST_IDS.ORDER_LIST.MULTI_COMBINE_BTN}
                  >
                    <Layers className="h-4 w-4 mr-2" />
                    Combinar
                  </Button>
                  <Button
                    className="flex-1"
                    variant="destructive"
                    onClick={async () => {
                      await handleCloseMultiple();
                    }}
                    data-testid={TEST_IDS.ORDER_LIST.MULTI_CLOSE_BTN}
                  >
                    Cerrar todas
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={clearOrderSelection}
                    data-testid={TEST_IDS.ORDER_LIST.MULTI_CLEAR_BTN}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : currentOrder ? (
              /* ── Single-order details ──────────────────────── */
              <>
                {!currentOrder.closed && (
                  <ChevronFloodButton
                    onClick={handleClose}
                    testId={TEST_IDS.ORDER_SHEET.ADD_MORE_BTN}
                  />
                )}
                <div className="animate-slide-up">
                  <OrderDetails order={currentOrder} />
                </div>
              </>
            ) : (
              /* ── No detail yet: text driven by selectedOrderIds ── */
              <StatusMessage>
                {selectedOrderIds.length > 0
                  ? "Cargando orden…"
                  : "Selecciona una orden"}
              </StatusMessage>
            )}
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
