"use client";

import { Suspense, useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useOrders } from "@/context/useOrders";
import OrdersList from "./OrderList";
import OrderDetails from "./OrderDetails";
import { Search, Calendar } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { OrdersQuery } from "@/lib/types";

export default function OrderHistoryPage() {
  const { fetchOrders, currentOrder } = useOrders();
  const [filterStatus, setFilterStatus] = useState<OrdersQuery['status']>("");
  
  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if(event.target.valueAsDate){
      fetchOrders({ date: format(event.target.valueAsDate, "yyyy-MM-dd") });
    }
  };

  useEffect(() => {
    fetchOrders({status: filterStatus})
  }, [filterStatus])

  return (
    <main className="container mx-auto px-4 py-8">
      <Card className="mb-8">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
          <CardTitle className="text-3xl font-bold">Historial de ordenes</CardTitle>
          <div className="flex items-center space-x-4">
            <div hidden className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Search orders..."
                className="pl-10 pr-4 py-2 w-full sm:w-64"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                type="date"
                defaultValue={format(new Date(), "yyyy-MM-dd")}
                onChange={handleDateChange}
                className="pl-10 pr-4 py-2 w-full sm:w-48"
              />
            </div>
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
          </div>
        </CardHeader>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Orders List */}
        <Suspense fallback={<Spinner className="mx-auto" />}>
          <OrdersList />
        </Suspense>

        {/* Selected Order Details */}
        <Card className="sticky lg:top-8 bottom-0 self-start">
          {currentOrder ? (
            <Suspense fallback={<Spinner className="mx-auto" />}>
              <OrderDetails order={currentOrder} />
            </Suspense>
          ) : (
            <>
              <CardHeader>
                <CardTitle>
                  <p className="text-center text-gray-500">Selecciona una orden para ver los detalles.</p>
                </CardTitle>
              </CardHeader>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
