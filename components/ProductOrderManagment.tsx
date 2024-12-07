'use client'
import { FilterControls } from '@/components/FilterControls';
import { OrderControls, ProductCard } from '@/components/ProductCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOrders } from '@/context/useOrders';
import { formatPrice } from '@/lib/utils/formatPrice';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useState } from 'react';
import Receipt from './ReceiptCard';

export default function ProductOrderManagment() {
    const {
        isPending,
        currentOrder,
        orders,
        visibleProducts,
        handleCloseOrder,
        setCurrentOrderDetails,
    } = useOrders();
    const [showDetail, setShowDetail] = useState(false);

    return (
        <div className="max-w-md mx-auto space-y-4 h-screen flex flex-col justify-between">
            <main className='p-4 pb-10 flex flex-wrap gap-2'>
                <FilterControls />
                {visibleProducts.map(product => (
                    <div key={product.id} className='flex-grow'>
                        <ProductCard product={product}>
                            <OrderControls product={product} />
                        </ProductCard>
                    </div>
                ))}
            </main>
            <footer className="sticky bottom-0 translate-y-2 pb-2 max-w-md w-full">
                {currentOrder?.items && (
                    <Card className="pb-4 translate-y-8 max-h-[70vh] overflow-auto relative">
                        <CardHeader className="sticky top-0 py-4 bg-white flex flex-row items-center gap-2 justify-between">
                            <Button size="sm" onClick={() => setShowDetail(!showDetail)}>
                                <b>
                                    Productos(
                                    {Array.from(currentOrder.items.values()).reduce(
                                        (totalQuantity, items) =>
                                            totalQuantity + items.items.length,
                                        0
                                    )}
                                    )
                                </b>
                                {showDetail ? <ArrowDown /> : <ArrowUp />}
                            </Button>
                            <div className="flex gap-2">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={isPending}
                                    onClick={handleCloseOrder}
                                >
                                    Cerrar orden
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setCurrentOrderDetails(null)}
                                >
                                    <X />
                                </Button>
                            </div>
                        </CardHeader>
                        {showDetail && (<>
                            <CardContent className="flex flex-col gap-2">
                                {Array.from(visibleProducts.values())
                                    .filter((product) => currentOrder.items.has(product.id))
                                    .map((product) => (
                                        <ProductCard key={product.id} product={product}>
                                            <OrderControls product={product} />
                                        </ProductCard>
                                    ))
                                }
                                <Receipt data={currentOrder} />
                            </CardContent>
                        </>
                        )}
                    </Card>
                )}
                <Card className="w-full sticky bottom-0">
                    <CardContent className="flex flex-col">
                        <div className="flex flex-wrap gap-2 py-2">
                            {Array.from(orders.values()).map((order) => (
                                <Badge
                                    key={order.id}
                                    variant="secondary"
                                    onClick={() => setCurrentOrderDetails(order)}
                                    hidden={currentOrder?.order.id === order.id}
                                    className="flex flex-col text-right"
                                >
                                    <span>#{order.position}</span>
                                    <span>{formatPrice(order.total)}</span>
                                </Badge>
                            ))}
                            {orders.size === 0 && (
                                <p className="w-full text-center text-gray-500">Aqui se mostraran las ordenes abiertas.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </footer>
        </div>
    );
};