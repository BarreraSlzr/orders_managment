"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale/es";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { OrderItemsFE } from "@/lib/types"
import { formatPrice } from "@/lib/utils/formatPrice"
import { Fragment, useState } from "react";
import { Checkbox } from "./ui/checkbox";
import { Split } from "lucide-react";
import { Button } from "./ui/button";
import { useOrders } from "@/context/useOrders";
import { handleSplitOrder } from "@/app/actions";

interface ReceiptProps {
  data: OrderItemsFE
  serverInfo?: {
    servedBy: string
    time: string
  }
}


export default function Receipt({ data, serverInfo }: ReceiptProps) {
  const { order, items } = data
  const itemsArray = Array.from(items.values())
  const total = itemsArray.reduce((acc, item) => acc + (item.price * item.quantity), 0)
  const [SplitingOrder, setSplitingOrder] = useState(false);
  const { handleSplitOrder } = useOrders()

  return (
    <Card className="w-full bg-white font-mono text-sm">
      <CardHeader className="text-center space-y-0 pb-3">
        <h1 className="font-bold text-lg tracking-wide">DETALLE DE ORDEN</h1>
        <p className="text-xs">{format(order.created, "EEEE, MMMM dd, yyyy, p", { locale: es }).toUpperCase()}</p>
        <p className="text-xs">ORDEN #{order.position}-{order.id.substring(0, 5).toUpperCase()}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={async (ev) => {
            ev.preventDefault();
            const formData = new FormData(ev.currentTarget);
            formData.append('orderId', data.order.id);
            const successResult = await handleSplitOrder(formData)
            if(successResult) setSplitingOrder(false);
          }}>
          <div className="flex flex-col gap-4">
            {itemsArray.map((item) => (
              <Fragment key={item.product_id}>
                {Array.from(Array(!SplitingOrder ? 1 : item.quantity).keys()).map((_, index) => (
                  <div key={item.product_id + index} className="flex justify-between">
                    <div className="items-top flex space-x-2">
                      {SplitingOrder && <Checkbox id={item.product_id + index} name="product_id" value={item.product_id} />}
                      <div className="grid gap-1.5 leading-none">
                        <label
                          htmlFor={item.product_id + index}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {item.name}
                        </label>
                        {!SplitingOrder &&
                          <p className="text-xs text-muted-foreground">Cant: {item.quantity}</p>
                        }
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <p className="text-xs text-muted-foreground">{formatPrice(item.price)}</p>
                      {!SplitingOrder &&
                        <p className="tabular-nums mt-auto">{formatPrice(item.price * item.quantity)}</p>
                      }
                    </div>
                  </div>
                ))}
              </Fragment>
            ))}
            <Separator />
            <div className="flex justify-between font-bold">
              <p>TOTAL:</p>
              <p className="tabular-nums">{formatPrice(total)}</p>
            </div>
          </div>
          <CardFooter className="flex gap-2 justify-between px-0 py-4 sticky bottom-0 bg-white">
            {!SplitingOrder ?
              <Button variant='secondary' size='sm' type="button"
                onClick={() => setSplitingOrder(true)}
              >Dividir cuenta <Split /></Button>
              : (<>
                <Button variant="destructive" size="sm" type="button" onClick={() => setSplitingOrder(false)}>
                  Cancelar
                </Button>
                <Button variant='default' size='sm' type="submit"
                >Crear cuenta <Split /></Button>
              </>)
            }
          </CardFooter>
        </form>
      </CardContent>
    </Card>
  )
}

