import { useOrders } from '@/context/useOrders';
import * as React from 'react';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';

export interface IOrderStatusProps {
    defaultStatus?: string
}

export default function OrderStatus ({defaultStatus = ''}: IOrderStatusProps) {
  const [filterStatus, setFilterStatus] = React.useState(defaultStatus);
  const { fetchOrders } = useOrders()
  React.useEffect(() => {
    fetchOrders({status: filterStatus || defaultStatus})
  }, [filterStatus])
  return (
    <ToggleGroup type="single" value={filterStatus} onValueChange={(value) => setFilterStatus(value)}>
    <ToggleGroupItem value="opened" aria-label="Show open orders">
      <div className="w-4 h-4 rounded-full bg-green-500" />
      <span hidden={filterStatus !== 'opened'} className="ml-2">Abiertas</span>
    </ToggleGroupItem>
    <ToggleGroupItem value="closed" aria-label="Show closed orders">
      <div className="w-4 h-4 rounded-full bg-red-500" />
      <span hidden={filterStatus !== 'closed'} className="ml-2">Cerradas</span>
    </ToggleGroupItem>
  </ToggleGroup>
  );
}
