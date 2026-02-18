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
import { ShoppingBag } from "lucide-react";
import { parseAsBoolean, useQueryState } from "nuqs";
import { Suspense } from "react";
import OrderStatus from "../Orders/OrderControls";
import OrderDetails from "../Orders/OrderDetails";
import OrdersList from "../Orders/OrderList";
import { OrderSummary } from "../OrderSummary";
import { Card, CardHeader } from "../ui/card";
import { Spinner } from "../ui/spinner";

export function OpenOrderSheet() {
  const { orders, currentOrder, setCurrentOrderDetails } = useOrders();
  const [sheetOpen, setSheetOpen] = useQueryState(
    "sheet",
    parseAsBoolean.withDefault(false),
  );

  function handleClose() {
    void setSheetOpen(false);
    void setCurrentOrderDetails(null);
  }

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
            ORDENES
          </SheetTitle>
          <div className="px-4 pr-10">
            <OrderStatus defaultStatus="opened" />
          </div>
        </SheetHeader>
        <div className="flex flex-col gap-4 overflow-auto min-h-full">
          {/* Orders List */}
          <Suspense fallback={<Spinner className="mx-auto" />}>
            <OrdersList />
          </Suspense>
          <div className="m-auto" />

          {/* Selected Order Details */}
          <Card className="sticky bottom-4 flex flex-col">
            {currentOrder ? (
              <Suspense fallback={<Spinner className="mx-auto" />}>
                <Button
                  className="flex-grow"
                  onClick={handleClose}
                  data-testid={TEST_IDS.ORDER_SHEET.ADD_MORE_BTN}
                >
                  Agregar mas productos
                </Button>
                <OrderDetails order={currentOrder} editMode />
              </Suspense>
            ) : (
              <CardHeader>
                <p
                  className="text-center text-gray-500"
                  data-testid={TEST_IDS.ORDER_SHEET.EMPTY_SELECTION}
                >
                  Selecciona una orden para ver los detalles.
                </p>
              </CardHeader>
            )}
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
