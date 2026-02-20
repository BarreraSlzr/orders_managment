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
  totalCount?: number;
  /** Optional date for filtering (YYYY-MM-DD). Undefined = today. */
  date?: string;
}

export default function OrderStatus({
  defaultStatus = "",
  value: controlledValue,
  onValueChange: controlledOnValueChange,
  openCount = 0,
  closedCount = 0,
  totalCount = 0,
  date,
}: IOrderStatusProps) {
  const [internalStatus, setInternalStatus] = React.useState(defaultStatus);
  const { fetchOrders } = useOrders();

  // Use controlled value if provided, otherwise use internal state
  const filterStatus =
    controlledValue !== undefined ? controlledValue : internalStatus;
  const setFilterStatus = controlledOnValueChange || setInternalStatus;

  React.useEffect(() => {
    // "all" → fetch with empty status (no open/closed filter, but date-scoped)
    const status = filterStatus === "all" ? "" : (filterStatus || defaultStatus);
    // When "all" is selected and no explicit date, pass today's date to keep it day-scoped
    const effectiveDate = (filterStatus === "all" && !date)
      ? new Date().toISOString().slice(0, 10)
      : date;
    fetchOrders({ status, date: effectiveDate });
  }, [filterStatus, date]);
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
      <ToggleGroupItem
        value="all"
        aria-label="Show all orders"
        data-testid={TEST_IDS.ORDER_CONTROLS.FILTER_ALL}
      >
        <div className="h-4 min-w-[1rem] rounded-full bg-slate-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
          {totalCount}
        </div>
        <span hidden={filterStatus !== "all"} className="ml-2">
          Todas
        </span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
