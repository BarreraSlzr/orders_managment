"use client";

import { OrderSummary } from "@/components/OrderSummary"; // API call to fetch order details
import { useOrders } from "@/context/useOrders";

export default function OrdersList() {
    const { orders, setCurrentOrderDetails, currentOrder } = useOrders();
  
    return (
      <div className="flex flex-col gap-2">
        {Array.from(orders.values()).map((order) => (
          <div
            key={order.id}
            className={`border rounded-lg p-4 cursor-pointer ${currentOrder?.order.id === order.id
                ? "bg-blue-100"
                : "hover:bg-gray-50"
                }`}
            onClick={() => setCurrentOrderDetails(order)}
          >
            <OrderSummary order={order} />
          </div>
        ))}
      </div>
    );
  }
