"use client";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { ReceiptEditProvider, useReceiptEdit } from "@/context/useReceiptEdit";
import { OrderItemsView } from "@/lib/sql/types";
import { PropsWithChildren } from "react";
import { Button } from "../ui/button";
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
    totalPrice,
    toggleEditMode,
    handleActionSubmit,
    handleStartMercadoPagoSync,
  } = useReceiptEdit();

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

  return (
    <Card className="w-full bg-white font-mono text-sm">
      <CardHeader className="text-center space-y-0 p-3">
        <h1 className="font-bold text-lg tracking-wide">DETALLE DE ORDEN</h1>
        <ReceiptHeader
          order={order}
          serverInfo={serverInfo}
          className="text-sm"
        />
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit}
          onReset={toggleEditMode}
          className="flex flex-col gap-3"
        >
          <ReceiptFooter orderTotal={order.total} />
          <ReceiptItems items={items} listProducts={editMode} />
          <CardFooter className="flex flex-wrap gap-2 justify-between p-0 sticky bottom-0 bg-white">
            {editMode && !!totalPrice && (
              <ReceiptFooter label="SUBTOTAL:" orderTotal={totalPrice} />
            )}
            {!editMode ? (
              <>
                {order.closed ? (
                  <>
                    <span className="text-xs text-muted-foreground">
                      Orden cerrada
                    </span>
                    <Button
                      variant="default"
                      size="sm"
                      type="button"
                      className="bg-blue-600 hover:bg-blue-700"
                      onClick={() =>
                        handleStartMercadoPagoSync({ orderId: order.id })
                      }
                    >
                      Cobrar con Mercado Pago
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      type="submit"
                      id="open"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Abrir orden
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="secondary" size="sm" type="reset">
                      Modificar productos
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      type="submit"
                      id="close"
                    >
                      Cerrar orden
                    </Button>
                  </>
                )}
              </>
            ) : (
              children || <ReceiptActions />
            )}
          </CardFooter>
        </form>
      </CardContent>
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
