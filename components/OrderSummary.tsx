import { format } from "date-fns";
import { es } from "date-fns/locale/es";
import { formatPrice } from "@/lib/utils/formatPrice";
import { Order } from "@/lib/types";
import { Badge } from "./ui/badge";

interface OrderSummaryProps {
    order: Order
}

export function OrderSummary({ order }: OrderSummaryProps) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
            <p className="font-bold text-sm">
                ORDEN #{order.position}-{order.id.slice(0, 5).toUpperCase()}
            </p>
            <p className="font-medium">Total: {formatPrice(order.total)}</p>
            </div>
            <div className="flex items-center gap-2">
                <Badge className="bg-green-700"/>
                <p className="text-xs">
                    {format(new Date(order.created), "EEEE, MMMM dd, yyyy, hh:mm a", { locale: es }).toUpperCase()}
                </p>
            </div>
            {
                !!(order.closed) &&
                <div className="flex items-center gap-2">
                    <Badge variant={'destructive'}/>
                    <p className="text-xs text-gray-500">
                        {format(new Date(order.closed), "EEEE, MMMM dd, yyyy, p", { locale: es }).toUpperCase()}
                    </p>
                </div>
            }
        </div>
    );
}
