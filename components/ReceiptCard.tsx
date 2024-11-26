"use client"

import { format } from "date-fns"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { OrderItemsFE } from "@/lib/types"

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

  return (
    <Card className="w-[380px] bg-white font-mono text-sm">
      <CardHeader className="text-center space-y-0 pb-3">
        <h1 className="font-bold text-lg tracking-wide">GITHUB RECEIPT</h1>
        <p className="text-xs">{format(order.created, "EEEE, MMMM dd, yyyy").toUpperCase()}</p>
        <p className="text-xs">ORDER #{order.id.substring(0, 5)}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Customer Section 
        <div className="space-y-1">
          <p>CUSTOMER: {order.customer_name}</p>
          <p className="text-muted-foreground">@{order.customer_username}</p>
        </div>
        */}

        {/* Items Section */}
        <div className="space-y-2">
          {itemsArray.map((item) => (
            <div key={item.product_id} className="flex justify-between">
              <div>
                <p>{item.name}</p>
                <p className="text-xs text-muted-foreground">Quantity: {item.quantity}</p>
              </div>
              <p className="tabular-nums">{item.price.toFixed(2)}</p>
            </div>
          ))}
          <Separator />
          <div className="flex justify-between font-bold">
            <p>TOTAL:</p>
            <p className="tabular-nums">{total.toFixed(2)}</p>
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

