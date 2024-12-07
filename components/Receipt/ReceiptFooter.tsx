import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Split } from "lucide-react";
import { formatPrice } from "@/lib/utils/formatPrice";
import { PropsWithChildren } from "react";

interface Props {
  orderTotal: number;
}

export function ReceiptFooter({
  orderTotal,
  children
}: PropsWithChildren<Props>) {
  return (
    <>
      <Separator />
      <div className="flex justify-between font-bold">
        <p>TOTAL:</p>
        <p className="tabular-nums">{formatPrice(orderTotal)}</p>
      </div>
        { children }
    </>
  );
}
