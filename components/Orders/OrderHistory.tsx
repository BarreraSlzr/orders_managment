"use client";

import { Suspense, useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useOrders } from "@/context/useOrders";
import OrdersList from "./OrderList";
import OrderDetails from "./OrderDetails";
import { Search, Calendar } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

export default function OrderHistoryPage() {
  const { fetchOrders, setCurrentOrder, currentOrder } = useOrders()
  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if(event.target.valueAsDate){
      fetchOrders({ date: format(event.target.valueAsDate, "yyyy-MM-dd") });
    }
  };

  // Handle global close event
  useEffect(() => {
    const closeHandler = () => setCurrentOrder(null);
    window.addEventListener("close-order-details", closeHandler);
    return () => window.removeEventListener("close-order-details", closeHandler);
  }, []);

  return (
    <main className="container mx-auto px-4 py-8">
      <Card className="mb-8">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
          <CardTitle className="text-3xl font-bold">Historial de ordenes</CardTitle>
          <div className="flex items-center space-x-4">
            <div className="relative">
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
