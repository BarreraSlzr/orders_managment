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
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  Pencil,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { parseAsBoolean, parseAsString, useQueryState } from "nuqs";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ItemSelectorContent } from "../Inventory/ItemSelector";
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

// ───────────────────────────────────────────────────────────────────────────────

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
  const today = useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Mexico_City",
      }).format(new Date()),
    [],
  );
  const [selectedDate, setSelectedDate] = useQueryState(
    "date",
    parseAsString.withDefault(today),
  );
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [gastoOpen, setGastoOpen] = useState(false);
  const [gastosListExpanded, setGastosListExpanded] = useState(false);
  const [editingGastoId, setEditingGastoId] = useState<number | null>(null);
  const trpc = useTRPC();
  const upsertTransactionMutation = useMutation(
    trpc.inventory.transactions.upsert.mutationOptions(),
  );
  const dailyGastosQuery = useQuery(
    trpc.inventory.transactions.dailyGastos.queryOptions({
      date: selectedDate,
    }),
  );
  const dailyGastosTotal = (dailyGastosQuery.data ?? []).reduce(
    (sum, row) => sum + row.total_cost,
    0,
  );
  const dailyGastosCount = (dailyGastosQuery.data ?? []).reduce(
    (sum, row) => sum + row.count,
    0,
  );
  const gastosByDateQuery = useQuery(
    trpc.inventory.transactions.byDate.queryOptions({ date: selectedDate }),
  );
  const deleteGastoMutation = useMutation(
    trpc.inventory.transactions.delete.mutationOptions(),
  );
  const batchCloseMutation = useMutation(
    trpc.orders.batchClose.mutationOptions(),
  );
  const lowStockQuery = useQuery(trpc.inventory.items.lowStock.queryOptions());
  const lowStockCount = lowStockQuery.data?.length ?? 0;
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
  // All orders for the selected date (open + closed) — used for the payment
  // summary so it stays accurate when the date picker changes.
  const allDayOrders = useMemo(
    () => [...(openOrdersQuery.data ?? []), ...(closedOrdersQuery.data ?? [])],
    [openOrdersQuery.data, closedOrdersQuery.data],
  );
  const summaryOrders = useMemo(() => {
    if (selectedOrderIds.length > 1) {
      return allDayOrders.filter((order) => selectedOrderIdSet.has(order.id));
    }
    return allDayOrders;
  }, [allDayOrders, selectedOrderIdSet, selectedOrderIds.length]);
  const dayTotal = summaryOrders.reduce((sum, order) => sum + order.total, 0);
  const detailsQueries = useQueries({
    queries: summaryOrders.map((order) =>
      trpc.orders.getDetails.queryOptions({ id: order.id }),
    ),
  });
  // Memoize so paymentSummary only recomputes when actual data changes.
  const detailsData = useMemo(
    () =>
      detailsQueries
        .map((query) => query.data)
        .filter(Boolean) as OrderItemsView[],

    [detailsQueries],
  );
  const isPaymentSummaryLoading =
    // isFetching (not isLoading) catches refetches too, e.g. date change
    openOrdersQuery.isFetching ||
    closedOrdersQuery.isFetching ||
    // isPending catches new queries that are registered but haven't started
    // fetching yet — the tick where isLoading would be false despite no data
    (summaryOrders.length > 0 && detailsData.length < summaryOrders.length) ||
    detailsQueries.some((query) => query.isPending);

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
        className="flex w-full h-full flex-col overflow-hidden sm:max-w-lg p-0 pt-4"
        data-testid={TEST_IDS.ORDER_SHEET.ROOT}
      >
        <SheetHeader className="flex flex-row gap-2 justify-between items-center p-0">
          <SheetTitle
            className="text-center text-xl font-bold px-3 cursor-pointer"
            onClick={handleClose}
          >
            ORDENES
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
        <div className="px-3 pt-2">
          {lowStockCount > 0 && (
            <Link href="/items?lowStock=true">
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-mono uppercase tracking-wide text-amber-800">
                <span>⚠️</span>
                <span>
                  {lowStockCount} ingrediente
                  {lowStockCount !== 1 ? "s" : ""} con stock bajo
                </span>
                <ChevronRight className="ml-auto h-3 w-3" />
              </div>
            </Link>
          )}
          <Card className="relative border-slate-300 bg-white font-mono">
            {/* Summary Header — Calendar | Date | Count+Total | Chevron */}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                void setSelectedDate(e.target.value || today);
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
              aria-label="Seleccionar fecha"
              className={cn(
                "absolute left-0 top-0 z-10 cursor-pointer p-1 rounded-tl-xl transition-all duration-200 ease-out",
                "w-36",
              )}
            />
            <button
              onClick={() => setSummaryExpanded(!summaryExpanded)}
              className="w-full px-3 py-2 text-[11px] uppercase tracking-widest text-slate-500 border-b border-dashed border-slate-300 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2 flex-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                <span className="tracking-wide text-slate-600">
                  {selectedDate === today
                    ? "Hoy"
                    : format(new Date(selectedDate + "T12:00:00"), "dd MMM", {
                        locale: es,
                      })}
                </span>
              </div>
              <div className="flex-1 text-right">
                <span className="text-slate-700">
                  {summaryOrders.length} orden
                  {summaryOrders.length === 1 ? "" : "es"}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-1 justify-end">
                <span className="text-sm font-bold tabular-nums text-slate-900">
                  {formatPrice(dayTotal)}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-slate-400 transition-transform",
                    summaryExpanded ? "rotate-0" : "-rotate-90",
                  )}
                />
              </div>
            </button>
            {/* Collapsible Payment Summary Details */}
            {summaryExpanded && (
              <div className="p-2 flex flex-col gap-1.5">
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
                {/* ── Gastos del día ── */}
                {dailyGastosCount > 0 && (
                  <div className="rounded border border-red-200 bg-red-50 overflow-hidden">
                    <button
                      onClick={() => setGastosListExpanded((v) => !v)}
                      className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 w-full px-2 py-1.5 text-[11px] hover:bg-red-100 transition-colors"
                    >
                      <span>📦</span>
                      <span className="uppercase tracking-wide text-red-700 text-left">
                        Gastos
                      </span>
                      <span className="text-red-400 tabular-nums">
                        x{dailyGastosCount}
                      </span>
                      <span className="font-semibold tabular-nums text-red-800 flex items-center gap-1">
                        −{formatPrice(dailyGastosTotal)}
                        <ChevronDown
                          className={cn(
                            "h-3 w-3 text-red-400 transition-transform",
                            gastosListExpanded ? "rotate-180" : "rotate-0",
                          )}
                        />
                      </span>
                    </button>
                    {gastosListExpanded && (
                      <div className="border-t border-red-200 flex flex-col divide-y divide-red-100">
                        {(gastosByDateQuery.data ?? []).map((row) => (
                          <div
                            key={row.id}
                            className="flex items-center gap-1.5 px-2 py-1.5 text-[11px]"
                          >
                            <span className="flex-1 text-red-800 font-medium truncate min-w-0">
                              {row.item_name}
                            </span>
                            <span className="text-red-500 tabular-nums shrink-0">
                              {row.quantity} {row.quantity_type_value}
                            </span>
                            <span className="text-red-800 tabular-nums font-semibold shrink-0">
                              {formatPrice(row.price)}
                            </span>
                            <button
                              onClick={() => {
                                setEditingGastoId(row.id);
                                setGastoOpen(true);
                              }}
                              className="text-red-300 hover:text-red-600 transition-colors shrink-0 px-0.5"
                              aria-label="Editar"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={async () => {
                                await deleteGastoMutation.mutateAsync({
                                  id: row.id,
                                });
                                void dailyGastosQuery.refetch();
                                void gastosByDateQuery.refetch();
                              }}
                              disabled={deleteGastoMutation.isPending}
                              className="text-red-300 hover:text-red-600 transition-colors shrink-0 px-0.5"
                              aria-label="Eliminar"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => setGastoOpen(true)}
                          className="flex items-center gap-1.5 px-2 py-2 text-[11px] text-red-600 hover:bg-red-100 transition-colors font-mono uppercase tracking-wide w-full"
                        >
                          <Plus className="h-3 w-3" />
                          Agregar gasto
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {/* ── Cerrar día ── */}
                {openCount > 0 && (
                  <button
                    onClick={async () => {
                      await batchCloseMutation.mutateAsync({
                        date: selectedDate,
                      });
                      void openOrdersQuery.refetch();
                      void dailyGastosQuery.refetch();
                      void lowStockQuery.refetch();
                    }}
                    disabled={batchCloseMutation.isPending}
                    className="mt-1 w-full rounded border border-zinc-300 bg-zinc-50 px-2 py-1.5 text-[11px] font-mono uppercase tracking-widest text-zinc-700 hover:bg-zinc-100 transition-colors disabled:opacity-50"
                  >
                    {batchCloseMutation.isPending
                      ? "Cerrando..."
                      : `Cerrar ${openCount} orden${
                          openCount !== 1 ? "es" : ""
                        } del día`}
                  </button>
                )}
              </div>
            )}
          </Card>
        </div>
        <div className="flex flex-col flex-1 min-h-0">
          {/* Orders List — shrinks when bottom panel expands */}
          <div className="flex-1 overflow-auto overscroll-contain touch-pan-y">
            <Suspense fallback={<Spinner className="mx-auto" />}>
              <OrdersList />
            </Suspense>
          </div>

          {/* ── Bottom panel — inside SheetContent, no portal, no z-conflict ── */}
          <div
            className={[
              "shrink-0 bg-black rounded-t-xl border border-zinc-800 text-white flex flex-col transition-all duration-200",
              currentOrder || gastoOpen ? "max-h-[85dvh] flex-1" : "",
            ].join(" ")}
          >
            {isMultiSelect ? (
              /* ── Multi-select bulk actions ───────────────── */
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
              /* ── Single-order detail ──────────────────── */
              <>
                {!currentOrder.closed && (
                  <ChevronFloodButton
                    onClick={() => void setSheetOpen(false)}
                    testId={TEST_IDS.ORDER_SHEET.ADD_MORE_BTN}
                  />
                )}
                <div className="animate-slide-up flex-1 min-h-0 overflow-hidden">
                  <OrderDetails order={currentOrder} />
                </div>
              </>
            ) : gastoOpen ? (
              /* ── Agregar / Editar gasto ─────────────────────────────── */
              <ItemSelectorContent
                key={editingGastoId ?? "new"}
                title={editingGastoId ? "Editar gasto" : "Agregar gasto"}
                initialValues={(() => {
                  if (!editingGastoId) return undefined;
                  const row = (gastosByDateQuery.data ?? []).find(
                    (r) => r.id === editingGastoId,
                  );
                  if (!row) return undefined;
                  return {
                    itemId: row.item_id,
                    itemName: row.item_name,
                    quantity: row.quantity,
                    unit: row.quantity_type_value,
                    price: row.price,
                  };
                })()}
                onConfirm={async ({ itemId, quantity, unit, price }) => {
                  await upsertTransactionMutation.mutateAsync({
                    itemId,
                    type: "IN",
                    quantity,
                    quantityTypeValue: unit,
                    price,
                    id: editingGastoId ?? undefined,
                  });
                  void dailyGastosQuery.refetch();
                  void gastosByDateQuery.refetch();
                  setGastoOpen(false);
                  setEditingGastoId(null);
                }}
                onCancel={() => {
                  setGastoOpen(false);
                  setEditingGastoId(null);
                }}
              />
            ) : (
              /* ── Idle strip ──────────────────────────────── */
              <button
                onClick={() => setGastoOpen(true)}
                data-testid={TEST_IDS.AGREGAR_GASTO.TRIGGER}
                className="group w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 transition-colors rounded-t-xl"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-700 group-hover:border-zinc-500 transition-colors">
                  <Plus className="h-3.5 w-3.5 text-zinc-400 group-hover:text-white transition-colors" />
                </span>
                <span className="text-xs font-mono uppercase tracking-widest text-zinc-500 group-hover:text-zinc-300 transition-colors">
                  Agregar gasto
                </span>
              </button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
