"use client"

import { Button } from "@/components/ui/button"
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { ShoppingBag } from 'lucide-react'
import { useOrders } from "@/context/useOrders"
import OrdersList from "../Orders/OrderList"
import { Suspense } from "react"
import { Spinner } from "../ui/spinner"
import { Card, CardHeader } from "../ui/card"
import OrderDetails from "../Orders/OrderDetails"
import { OrderSummary } from "../OrderSummary"
import OrderStatus from "../Orders/OrderControls"

interface OrderSummaryProps {
}

export function OpenOrderSheet({ }: OrderSummaryProps) {
    const { orders, currentOrder } = useOrders()

    return (
        <Sheet>
            <SheetTrigger asChild>
                <div className="ms-auto flex flex-wrap gap-2">
                    {currentOrder &&
                        <Button variant={'default'} className='h-16 rounded-full relative px-8 flex-grow'>
                            <OrderSummary order={currentOrder} minimal />
                        </Button>
                    }
                    <Button className="relative h-16 w-16 rounded-full ms-auto">
                        <ShoppingBag className="h-6 w-6" />
                        <span className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-primary text-primary-foreground">
                            {orders.size}
                        </span>
                    </Button>
                </div>
            </SheetTrigger>
            <SheetContent className="flex w-full flex-col sm:max-w-lg p-0 pt-4">
                <SheetHeader className="flex flex-row gap-2 justify-between items-center p-0">
                    <SheetClose asChild>
                        <SheetTitle className="text-center text-xl font-bold px-4">
                            ORDENES
                        </SheetTitle>
                    </SheetClose>
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
                                <SheetClose asChild>
                                    <Button className="flex-grow">
                                        Agregar mas porductos
                                    </Button>
                                </SheetClose>
                                <OrderDetails order={currentOrder} editMode />
                            </Suspense>
                        ) : (
                            <CardHeader>
                                <p className="text-center text-gray-500">Selecciona una orden para ver los detalles.</p>
                            </CardHeader>
                        )}
                    </Card>
                </div>
            </SheetContent>
        </Sheet>
    )
}

