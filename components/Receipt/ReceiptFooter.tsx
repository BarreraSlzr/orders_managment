import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Split } from "lucide-react";
import { formatPrice } from "@/lib/utils/formatPrice";
import { PropsWithChildren } from "react";

interface Props {
  label?: string;
  orderTotal: number;
}

export function ReceiptFooter({
  label = 'TOTAL:',
  orderTotal,
  children
}: PropsWithChildren<Props>) {
  return (
    <>
      <Separator />
      <div className="flex-grow flex justify-between font-bold">
        <p>{label}</p>
        <p className="tabular-nums">{formatPrice(orderTotal)}</p>
      </div>
    </>
  );
}
