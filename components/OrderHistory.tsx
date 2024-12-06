"use client";

import { useEffect, useState } from "react";
import Receipt from "@/components/Receipt/Receipt";
import { OrderSummary } from "@/components/OrderSummary"; // API call to fetch order details
import { Spinner } from "@/components/ui/spinner";
import { Order, OrderItemsFE } from "@/lib/types";
import { getOrders } from "@/lib/sql/functions/getOpenOrders";
import { getOrderItemsDetailed } from "@/lib/sql/functions/getOrderItemsDetailed";

interface Props {
    orders: Order[]
}

export default function OrderHistoryPage({ orders: os }: Props) {
    const [orders, setOrders] = useState<Order[]>(os);
    const [selectedOrder, setSelectedOrder] = useState<OrderItemsFE | null>(null);
    const [loadingOrders, setLoadingOrders] = useState(true);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Fetch orders initially
    useEffect(() => {
        const fetchOrders = async () => {
            setLoadingOrders(true);
            try {
                const history = await getOrders(); // API call for order history
                setOrders(history);
            } catch (error) {
                console.error("Failed to fetch orders:", error);
            } finally {
                setLoadingOrders(false);
            }
        };
        fetchOrders();
    }, []);

    // Fetch selected order details
    const handleSelectOrder = async (order: Order) => {
        setLoadingDetails(true);
        try {
            const items = await getOrderItemsDetailed(order.id); // API call for order details
            setSelectedOrder({ order, items: new Map(items.map(it => [it.product_id, it])) });
        } catch (error) {
            console.error("Failed to fetch order details:", error);
        } finally {
            setLoadingDetails(false);
        }
    };

    return (
        <div className="container mx-auto p-4 space-y-4">
            <h1 className="text-2xl font-bold text-center">Historial de Órdenes</h1>
            {loadingOrders ? (
                <Spinner className="mx-auto" />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Orders List */}
                    <div className="flex flex-col gap-2">
                        {orders.map((order) => (
                            <div
                                key={order.id}
                                className={`border rounded-lg p-4 cursor-pointer ${selectedOrder?.order.id === order.id
                                        ? "bg-blue-100"
                                        : "hover:bg-gray-50"
                                    }`}
                                onClick={() => handleSelectOrder(order)}
                            >
                                <OrderSummary order={order} />
                            </div>
                        ))}
                    </div>

                    {/* Selected Order Details */}
                    <div className="lg:col-span-1">
                        {loadingDetails ? (
                            <Spinner className="mx-auto" />
                        ) : selectedOrder ? (
                            <Receipt data={selectedOrder} />
                        ) : (
                            <p className="text-center text-gray-500">
                                Selecciona una orden para ver los detalles.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
