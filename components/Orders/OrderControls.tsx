import { useOrders } from "@/context/useOrders";
import { TEST_IDS } from "@/lib/testIds";
import * as React from "react";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";

export interface IOrderStatusProps {
  defaultStatus?: string;
  /** If provided, makes this a controlled component */
  value?: string;
  /** Callback when the status changes */
  onValueChange?: (value: string) => void;
  openCount?: number;
  closedCount?: number;
}

export default function OrderStatus({
  defaultStatus = "",
  value: controlledValue,
  onValueChange: controlledOnValueChange,
  openCount = 0,
  closedCount = 0,
}: IOrderStatusProps) {
  const [internalStatus, setInternalStatus] = React.useState(defaultStatus);
  const { fetchOrders } = useOrders();

  // Use controlled value if provided, otherwise use internal state
  const filterStatus =
    controlledValue !== undefined ? controlledValue : internalStatus;
  const setFilterStatus = controlledOnValueChange || setInternalStatus;

  React.useEffect(() => {
    fetchOrders({ status: filterStatus || defaultStatus });
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
        <div className="h-4 min-w-[1rem] rounded-full bg-amber-400 text-black text-[10px] font-bold flex items-center justify-center px-1">
          {openCount}
        </div>
        <span hidden={filterStatus !== "opened"} className="ml-2">
          Abiertas
        </span>
      </ToggleGroupItem>
      <ToggleGroupItem
        value="closed"
        aria-label="Show closed orders"
        data-testid={TEST_IDS.ORDER_CONTROLS.FILTER_CLOSED}
      >
        <div className="h-4 min-w-[1rem] rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center px-1">
          {closedCount}
        </div>
        <span hidden={filterStatus !== "closed"} className="ml-2">
          Cerradas
        </span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
