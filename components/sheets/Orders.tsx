"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useOrders } from "@/context/useOrders";
import { TEST_IDS } from "@/lib/testIds";
import { ChevronLeft, Layers, ShoppingBag, X } from "lucide-react";
import { parseAsBoolean, useQueryState } from "nuqs";
import { Suspense, useEffect, useRef, useState } from "react";
import OrderStatus from "../Orders/OrderControls";
import OrderDetails from "../Orders/OrderDetails";
import OrdersList from "../Orders/OrderList";
import { OrderSummary } from "../OrderSummary";
import { cn } from "@/lib/utils";
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

  // Auto-switch to "closed" tab when viewing a closed order
  useEffect(() => {
    if (currentOrder?.closed) {
      setFilterStatus("closed");
    }
  }, [currentOrder?.closed]);

  function handleClose() {
    void setSheetOpen(false);
    void setCurrentOrderDetails(null);
  }

  const isMultiSelect = selectedOrderIds.length > 1;
  const multiSelectLabel =
    selectedOrderIds.length > 0
      ? `${selectedOrderIds.length} seleccionadas`
      : null;

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
          <ShoppingBag className="h-6 w-6" />
          <span
            className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-primary text-primary-foreground"
            data-testid={TEST_IDS.ORDER_SHEET.COUNT_BADGE}
          >
            {orders.size}
          </span>
        </Button>
      </div>
      <SheetContent
        className="flex w-full flex-col sm:max-w-lg p-0 pt-4"
        data-testid={TEST_IDS.ORDER_SHEET.ROOT}
      >
        <SheetHeader className="flex flex-row gap-2 justify-between items-center p-0">
          <SheetTitle
            className="text-center text-xl font-bold px-4 cursor-pointer"
            onClick={handleClose}
          >
            {multiSelectLabel ?? "ORDENES"}
          </SheetTitle>
          <div className="px-4 pr-10">
            <OrderStatus
              defaultStatus="opened"
              value={filterStatus}
              onValueChange={setFilterStatus}
            />
          </div>
        </SheetHeader>
        <div className="flex flex-col flex-1 min-h-0">
          {/* Orders List — scrollable region */}
          <div className="flex-1 overflow-auto">
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
