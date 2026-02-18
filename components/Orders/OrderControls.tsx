import { useOrders } from "@/context/useOrders";
import { TEST_IDS } from "@/lib/testIds";
import * as React from "react";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";

export interface IOrderStatusProps {
  defaultStatus?: string;
}

export default function OrderStatus({ defaultStatus = "" }: IOrderStatusProps) {
  const [filterStatus, setFilterStatus] = React.useState(defaultStatus);
  const { fetchOrders } = useOrders();
  React.useEffect(() => {
    fetchOrders({ status: filterStatus || defaultStatus });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);
  return (
    <ToggleGroup
      type="single"
      value={filterStatus}
      onValueChange={(value) => setFilterStatus(value)}
      data-testid={TEST_IDS.ORDER_CONTROLS.ROOT}
    >
      <ToggleGroupItem
        value="opened"
        aria-label="Show open orders"
        data-testid={TEST_IDS.ORDER_CONTROLS.FILTER_OPENED}
      >
        <div className="w-4 h-4 rounded-full bg-green-500" />
        <span hidden={filterStatus !== "opened"} className="ml-2">
          Abiertas
        </span>
      </ToggleGroupItem>
      <ToggleGroupItem
        value="closed"
        aria-label="Show closed orders"
        data-testid={TEST_IDS.ORDER_CONTROLS.FILTER_CLOSED}
      >
        <div className="w-4 h-4 rounded-full bg-red-500" />
        <span hidden={filterStatus !== "closed"} className="ml-2">
          Cerradas
        </span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
