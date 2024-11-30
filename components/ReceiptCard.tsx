"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale/es";
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { OrderItemsFE } from "@/lib/types"
import { formatPrice } from "@/lib/utils/formatPrice"
import { Fragment } from "react";
import { Checkbox } from "./ui/checkbox";

interface ReceiptProps {
  data: OrderItemsFE
  splitting: boolean
  serverInfo?: {
    servedBy: string
    time: string
  }
}


export default function Receipt({ data, serverInfo, splitting }: ReceiptProps) {
  const { order, items } = data
  const itemsArray = Array.from(items.values())
  const total = itemsArray.reduce((acc, item) => acc + (item.price * item.quantity), 0)

  return (
    <Card className="w-full bg-white font-mono text-sm">
      <CardHeader className="text-center space-y-0 pb-3">
        <h1 className="font-bold text-lg tracking-wide">DETALLE DE ORDEN</h1>
        <p className="text-xs">{format(order.created, "EEEE, MMMM dd, yyyy, p", {locale: es}).toUpperCase()}</p>
        <p className="text-xs">ORDEN #{order.position }-{order.id.substring(0, 5).toUpperCase()}</p></CardHeader>
      <CardContent className="space-y-6">
        {/* Customer Section 
        <div className="space-y-1">
          <p>CUSTOMER: {order.customer_name}</p>
          <p className="text-muted-foreground">@{order.customer_username}</p>
        </div>
        */}

        {/* Items Section */}
        <div className={`flex flex-col ${splitting ? 'gap-4' : 'gap-2'}`}>
          {itemsArray.map((item) => (<Fragment key={item.product_id}>
            {Array.from(Array(!splitting ? 1 : item.quantity).keys()).map((x, index) => (
              <div key={item.product_id + index} className="flex justify-between">
                <div className="items-top flex space-x-2">
                  {splitting && <Checkbox id={item.product_id + index} />}
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor={item.product_id + index}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {item.name}
                    </label>
                    {!splitting &&
                      <p className="text-xs text-muted-foreground">Cant: {item.quantity}</p>
                    }
                  </div>
                </div>
                <div className="flex flex-col">
                  <p className="text-muted-foreground">{formatPrice(item.price)}</p>
                  {!splitting &&
                    <p className="text-xs tabular-nums font-bold mt-auto">{formatPrice(item.price * item.quantity)}</p>
                  }
                </div>
              </div>
            ))}
          </Fragment>))}
          <Separator />
          <div className="flex justify-between font-bold">
            <p>TOTAL:</p>
            <p className="tabular-nums">{formatPrice(total)}</p>
          </div>
        </div>

        {/* Server Info */}
        {serverInfo && (
          <div className="text-center space-y-1 text-xs">
            <p>Served by: {serverInfo.servedBy}</p>
            <p>{serverInfo.time}</p>
          </div>
        )}

        {/* Order Info
        <div className="space-y-2">
          <div className="text-center space-y-1">
            <p className="font-bold">COUPON CODE: {order.coupon_code || "N/A"}</p>
            <p className="text-xs">Save for your next order!</p>
          </div>

          {order.payment_info && (
            <div className="space-y-1 text-xs">
              <p>CARD #: **** **** **** {order.payment_info.last4}</p>
              <p>AUTH CODE: {order.payment_info.auth_code}</p>
              <p>CARDHOLDER: {order.payment_info.cardholder}</p>
            </div>
          )}
        </div>
         */}

        <div className="text-center space-y-4">
          <p className="font-bold">Gracias por consumir!</p>

          {/* Barcode 
          <div className="flex justify-center">
            <Barcode className="h-12 w-full" />
          </div>
          
          <p className="text-xs text-muted-foreground pb-2">
            github.com/{order.customer_username}
          </p>
          */}
        </div>
      </CardContent>
    </Card>
  )
}

