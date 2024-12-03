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
  const total = itemsArray.reduce((acc, item) => acc + (item.price * item.items.length), 0)
  const [ListProducts, setListProducts] = useState(false);
  const { handleSplitOrder, handleUpdateItemDetails } = useOrders()

  return (
    <Card className="w-full bg-white font-mono text-sm">
      <CardHeader className="text-center space-y-0 pb-3">
        <h1 className="font-bold text-lg tracking-wide">DETALLE DE ORDEN</h1>
        <p className="text-xs">{format(order.created, "EEEE, MMMM dd, yyyy, p", { locale: es }).toUpperCase()}</p>
        <p className="text-xs">ORDEN #{order.position}-{order.id.substring(0, 5).toUpperCase()}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          onSubmit={async (ev) => {
            ev.preventDefault();
            const formData = new FormData(ev.currentTarget);
            const submitter = (ev.nativeEvent as SubmitEvent).submitter as HTMLButtonElement; // Identify the button
            formData.append('orderId', data.order.id);

            switch (submitter.id) {
              case 'split':
                // Call server action for split order
                const splitSuccess = await handleSplitOrder(formData);
                if (splitSuccess) setListProducts(false);
                break;

              case 'updatePayment':
              case 'toggleTakeAway':
                const updateSuccess = await handleUpdateItemDetails(submitter.id, formData);
                if (updateSuccess) setListProducts(false);
                break;

              default:
                console.error('Unknown submit action:', submitter.id);
            }
          }}
        >
          <div className="flex flex-col gap-4">
            {itemsArray.map((item) => (
              <Fragment key={item.product_id}>
                {Array.from(ListProducts ? item.items : [{ id: 0, is_takeaway: false, payment_option_id: 1 }])
                  .map(({ id, is_takeaway, payment_option_id }) => (
                    <div key={id} className="flex justify-between">
                      <div className="items-top flex space-x-2">
                        {ListProducts && <Checkbox id={`item_${id}`} name="item_id" value={id} />}
                        <div className="grid gap-1.5 leading-none">
                          <div className="flex gap-2">
                            <label
                              htmlFor={`item_${id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {item.name}
                            </label>
                            {ListProducts && (
                              <>
                                <span title="Take Away">{is_takeaway ? '🛍️' : ''}</span>
                                <span title="Payment">{payment_option_id === 1 ? '💵' : '💳'}</span>
                              </>)}
                          </div>
                          <div className="flex gap-1">
                            {!ListProducts && (
                              <p className="text-xs text-muted-foreground">Cant: {item.items.length}</p>
                            )}
                            {!ListProducts && (
                              <>
                                <span title="Take Away">
                                  {item.items
                                    .map(it => it.is_takeaway ? '🛍️' : '')
                                    .join('')}</span>
                                <span title="Payment">
                                  {item.items
                                    .map(it => (it.payment_option_id === 1) ? '💵' : '💳')
                                    .join('')}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <p className="text-xs text-muted-foreground">{formatPrice(item.price)}</p>
                        {!ListProducts && (
                          <p className="tabular-nums mt-auto">{formatPrice(item.price * item.items.length)}</p>
                        )}
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
          <CardFooter className="flex flex-wrap gap-2 justify-between px-0 py-4 sticky bottom-0 bg-white">
            {!ListProducts ? (
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setListProducts(true)}
              >
                Modificar productos
              </Button>
            ) : (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  type="button"
                  onClick={() => setListProducts(false)}
                >
                  Cancelar
                </Button>
                <Button variant="default" size="sm" type="submit" id="split">
                  Nueva<Split />
                </Button>
                <Button variant="default" size="sm" type="submit" id="updatePayment">
                  Metodo de pago 💳
                </Button>
                <Button variant="default" size="sm" type="submit" id="toggleTakeAway">
                  Para llevar 🛍️
                </Button>
              </>
            )}
          </CardFooter>
        </form>
      </CardContent>
    </Card>
  )
}

