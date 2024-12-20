"use client";

import { OrderSummary } from "@/components/OrderSummary"; // API call to fetch order details
import { useOrders } from "@/context/useOrders";
import EmptyOrders from "./EmptyState";

export default function OrdersList() {
    const { orders, setCurrentOrderDetails, currentOrder } = useOrders();
  
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from(orders.values()).map((order) => (
          <div
            key={order.id}
            className={`border rounded-lg p-4 cursor-pointer touch-auto hover:shadow-md transition-shadow ${currentOrder?.id === order.id
                ? "bg-blue-100"
                : "hover:bg-gray-50"
                }`}
            onClick={() => setCurrentOrderDetails(order)}
          >
            <OrderSummary order={order} />
          </div>
        ))}
        { orders.size === 0 && <EmptyOrders/>}
      </div>
    );
  }
