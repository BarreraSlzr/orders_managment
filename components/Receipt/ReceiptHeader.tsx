import { Order } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale/es";

interface ReceiptHeaderProps {
  order: Order;
  serverInfo?: {
    servedBy: string;
    time: string;
  };
}

export function ReceiptHeader({ order, serverInfo, className }: ReceiptHeaderProps & React.JSX.IntrinsicElements['p']) {
  return (
    <>
      <p className={className}>
        {format(new Date(order.created), "EEEE, MMMM dd, yyyy,  hh:mm a", { locale: es }).toUpperCase()}
      </p>
      <p className={className}>ORDEN #{order.position}-{order.id.slice(0, 5).toUpperCase()}</p>
      {serverInfo && (
        <p className={className}>Atendido por: {serverInfo.servedBy} | {serverInfo.time}</p>
      )}
    </>
  );
}
