"use client";

import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { ReceiptEditProvider, useReceiptEdit } from "@/context/useReceiptEdit";
import { OrderItemsView } from "@/lib/sql/types";
import { MpSyncResult } from "@/lib/types";
import { PropsWithChildren, useRef, useState } from "react";
import { toast } from "sonner";
import { MercadoPagoPaymentModal } from "./MercadoPagoPaymentModal";
import { ReceiptActions } from "./ReceiptActions";
import { ReceiptFooter } from "./ReceiptFooter";
import { ReceiptHeader } from "./ReceiptHeader";
import { ReceiptItems } from "./ReceiptItems";

interface ReceiptProps {
  data: OrderItemsView;
  editMode?: boolean;
  serverInfo?: {
    servedBy: string;
    time: string;
  };
}

// ─── Inner shell — consumes ReceiptEditContext ────────────────────────────────

function ReceiptForm({
  serverInfo,
  children,
}: PropsWithChildren<Pick<ReceiptProps, "serverInfo">>) {
  const {
    order,
    items,
    editMode,
    toggleEditMode,
    handleActionSubmit,
    handleStartMercadoPagoSync,
  } = useReceiptEdit();

  const [mpResult, setMpResult] = useState<MpSyncResult | null>(null);
  const [mpLoading, setMpLoading] = useState(false);
  const [showTotalRightPadding, setShowTotalRightPadding] = useState(false);
  const headerBlockRef = useRef<HTMLDivElement>(null);

  const handleMercadoPagoClick = async () => {
    setMpLoading(true);
    try {
      const result = await handleStartMercadoPagoSync({
        orderId: order.id,
        flow: "pdv",
      });
      setMpResult(result);
    } catch (error) {
      // Show toast for MP configuration errors
      const errorMessage =
        error instanceof Error ? error.message : "Error al procesar pago";
      if (errorMessage.includes("not configured")) {
        toast.error("Mercado Pago no configurado", {
          description: "Configura tus credenciales para empezar a cobrar.",
          action: {
            label: "Configurar",
            onClick: () => {
              window.dispatchEvent(
                new CustomEvent("openSettings", {
                  detail: { tab: "mercadopago" },
                }),
              );
            },
          },
          duration: 6000,
        });
      } else {
        toast.error("Error al procesar pago", {
          description: errorMessage,
          duration: 4000,
        });
      }
    } finally {
      setMpLoading(false);
    }
  };

  const handleSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const formData = new FormData(ev.currentTarget);
    const submitter = (ev.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement;
    formData.append("orderId", `${order.id}`);
    const actionType = submitter.id as Parameters<typeof handleActionSubmit>[0];
    if (!actionType) {
      console.error("Unknown submit action:", submitter.id);
      return;
    }
    await handleActionSubmit(actionType, formData);
  };

  const handleReceiptScroll = (ev: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = ev.currentTarget.scrollTop;
    const headerHeight = headerBlockRef.current?.offsetHeight ?? 0;
    const shouldShowPadding = scrollTop >= headerHeight;
    if (shouldShowPadding !== showTotalRightPadding) {
      setShowTotalRightPadding(shouldShowPadding);
    }
  };

  return (
    <Card className="w-full h-full bg-white font-mono text-sm flex flex-col overflow-hidden">
      <CardContent className="flex-1 min-h-0 p-0">
        <form
          onSubmit={handleSubmit}
          onReset={toggleEditMode}
          className="h-full min-h-0 flex flex-col"
        >
          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch]"
            onScroll={handleReceiptScroll}
          >
            <div ref={headerBlockRef} className="text-center space-y-0 p-3">
              <h1 className="font-bold text-lg tracking-wide">DETALLE DE ORDEN</h1>
              <ReceiptHeader
                order={order}
                serverInfo={serverInfo}
                className="text-sm"
              />
            </div>
            <div
              className={`sticky top-0 z-20 bg-white px-3 pt-1 transition-[padding] duration-200 ease-out ${
                showTotalRightPadding ? "pr-10" : ""
              }`}
            >
              <ReceiptFooter orderTotal={order.total} />
              <hr className="border-dashed border-gray-400 mt-1"/>
            </div>
            <div className="px-3 pb-2 pt-2">
              <ReceiptItems items={items} listProducts={editMode} />
            </div>
          </div>

          <CardFooter className="shrink-0 bg-white border-t border-slate-200 p-2 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
            <ReceiptActions
              orderClosed={Boolean(order.closed)}
              mpLoading={mpLoading}
              onMercadoPagoClick={handleMercadoPagoClick}
            >
              {children}
            </ReceiptActions>
          </CardFooter>
        </form>
      </CardContent>

      {/* Mercado Pago payment status modal */}
      {mpResult && (
        <MercadoPagoPaymentModal
          result={mpResult}
          orderId={order.id.toString()}
          onClose={() => setMpResult(null)}
          onRetry={() => {
            setMpResult(null);
            void handleMercadoPagoClick();
          }}
        />
      )}
    </Card>
  );
}

// ─── Public export — provides the context then renders the shell ──────────────

export default function Receipt({
  data,
  editMode,
  serverInfo,
  children,
}: PropsWithChildren<ReceiptProps>) {
  return (
    <ReceiptEditProvider data={data} defaultEditMode={editMode}>
      <ReceiptForm serverInfo={serverInfo}>{children}</ReceiptForm>
    </ReceiptEditProvider>
  );
}
