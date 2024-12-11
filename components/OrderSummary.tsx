import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatPrice } from "@/lib/utils/formatPrice";
import { Order } from "@/lib/types";
import { Badge, BadgeProps } from "@/components/ui/badge";

interface OrderSummaryProps {
  order: Order;
  minimal?: boolean;
}

export function OrderSummary({ order, minimal = false }: OrderSummaryProps) {
  const { id, position, total, created, closed } = order;

  const MainData = () => (<>
    <p className="font-bold text-sm">
    ORDEN #{position}-{id.slice(0, 5).toUpperCase()}
  </p>
  <Badge variant="secondary" className={`font-medium rounded-full ${minimal ? 'mx-auto' : ''}`.trim()}>
    Total: {formatPrice(total)}
  </Badge>
  </>
  )

  return (
    <div className="flex flex-col gap-2">
        { minimal 
        ? (
            <MainData/>
        ) : (
          <>
          <div className={"flex justify-between items-center"}>
            <MainData/>
          </div>
          <DateBadge date={created} variant="success" />
          {closed && <DateBadge date={closed} variant="destructive" />}
        </>
      )}
    </div>
  );
}

interface DateBadgeProps {
  date: Date;
  variant: BadgeProps['variant'];
}

function DateBadge({ date, variant }: DateBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <Badge variant={variant} />
      <p className="text-xs text-gray-500">
        {format(new Date(date), "EEEE, MMMM dd, yyyy, p", { locale: es }).toUpperCase()}
      </p>
    </div>
  );
}

