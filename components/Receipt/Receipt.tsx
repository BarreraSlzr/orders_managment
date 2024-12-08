"use client";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { ReceiptHeader } from "./ReceiptHeader";
import { ReceiptItems } from "./ReceiptItems";
import { ReceiptFooter } from "./ReceiptFooter";
import { OrderItemsFE } from "@/lib/types";
import { PropsWithChildren, useState } from "react";
import { useOrderItemsProducts } from "@/context/useOrderItemsProducts";
import { Button } from "../ui/button";
import { ReceiptActions } from "./ReceiptActions";
import { useOrders } from "@/context/useOrders";
import { handleCloseOrder } from "@/app/actions";

interface ReceiptProps {
    data: OrderItemsFE;
    editMode?: boolean;
    serverInfo?: {
        servedBy: string;
        time: string;
    };
}

export default function Receipt({ data, serverInfo, editMode: defaultEditMode = false, children }: PropsWithChildren<ReceiptProps>) {
    const { order, items } = data;
    const [editMode, setEditMode] = useState(defaultEditMode);
    const { handleSplitOrder, handleUpdateItemDetails } = useOrders();

    const handleSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
        ev.preventDefault();
        const formData = new FormData(ev.currentTarget);
        const submitter = (ev.nativeEvent as SubmitEvent).submitter as HTMLButtonElement;
        formData.append("orderId", data.order.id);

        switch (submitter.id) {
            case "split":
                await handleSplitOrder(formData);
                setEditMode(false);
                break;
            case "updatePayment":
            case "toggleTakeAway":
            case "remove":
                await handleUpdateItemDetails(submitter.id, formData);
                setEditMode(false);
                break;
            case 'close':
                await handleCloseOrder(formData)
                break;
            default:
                console.error("Unknown submit action:", submitter.id);
        }
    };

    function handleReset(): void {
        setEditMode(!editMode)
    }

    return (
        <Card className="w-full bg-white font-mono text-sm">
            <CardHeader className="text-center space-y-0 pb-3">
                <h1 className="font-bold text-lg tracking-wide">DETALLE DE ORDEN</h1>
                <ReceiptHeader order={order} serverInfo={serverInfo} className="text-sm" />
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} onReset={handleReset} className="flex flex-col gap-3">
                    <ReceiptItems items={items} listProducts={editMode} />
                    <ReceiptFooter orderTotal={order.total}>
                        <CardFooter className="flex flex-wrap gap-2 justify-between px-0 sticky bottom-0 bg-white">
                            {
                                !editMode ? (<>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        type="reset"
                                    >Modificar productos</Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        type="submit"
                                        id='close'
                                    >
                                        Cerrar orden
                                    </Button>
                                </>
                                ) : (children || <ReceiptActions />)
                            }
                        </CardFooter>
                    </ReceiptFooter>
                </form>
            </CardContent>
        </Card>
    );
}
