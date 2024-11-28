'use client'
import { FilterControls } from '@/components/FilterControls';
import { ProductCard } from '@/components/ProductCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOrders } from '@/context/useOrders';
import { formatPrice } from '@/lib/utils/formatPrice';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useState } from 'react';
import Receipt from './ReceiptCard';

export default function ProductOrderManagment() {
    const {
        products,
        isPending,
        currentOrder,
        orders,
        searchQuery,
        selectedTags,
        visibleProducts,
        visibleTags,
        handleAddOrder,
        handleUpdateOrderItems,
        handleCloseOrder,
        setSearchQuery,
        setSelectedTags,
        setCurrentOrderDetails,
        resetFilters
    } = useOrders();
    const [showDetail, setShowDetail] = useState(false);

    return (
        <div className="max-w-md mx-auto space-y-4 h-screen flex flex-col justify-between">
            <main className='p-4 pb-10 flex flex-wrap gap-2'>
                <FilterControls
                    searchQuery={searchQuery}
                    visibleTags={visibleTags}
                    selectedTags={selectedTags}
                    setSearchQuery={setSearchQuery}
                    setSelectedTags={setSelectedTags}
                    resetFilters={resetFilters}
                />
                {visibleProducts.map(product => (
                    <div
                        className='flex-grow'
                        key={product.id}>
                        <ProductCard
                            product={product}
                            currentOrder={currentOrder}
                            handleAddOrder={handleAddOrder}
                            handleUpdateOrderItems={handleUpdateOrderItems}
                            isPending={isPending}
                        />
                    </div>
                ))}
            </main>

            <footer className="sticky bottom-0 translate-y-2 pb-2 max-w-md w-full">
                {currentOrder?.items && (
                    <Card className="py-4 translate-y-8">
                        <CardHeader className="pt-1 px-4">
                            <Button variant="outline" size="sm" onClick={() => setShowDetail(!showDetail)}>
                                <b>
                                    Productos seleccionados (
                                    {Array.from(currentOrder.items.values()).reduce(
                                        (totalQuantity, items) =>
                                            totalQuantity + items.quantity,
                                        0
                                    )}
                                    )
                                </b>
                                {showDetail ? <ArrowDown /> : <ArrowUp />}
                            </Button>
                        </CardHeader>
                        {showDetail && (
                            <CardContent className="flex flex-col gap-2">
                                {products
                                    .filter((product) => currentOrder.items.has(product.id))
                                    .map((product) => (
                                        <ProductCard
                                            key={product.id}
                                            product={product}
                                            currentOrder={currentOrder}
                                            handleAddOrder={handleAddOrder}
                                            handleUpdateOrderItems={handleUpdateOrderItems}
                                            isPending={isPending}
                                        />
                                    ))
                                }
                                <Receipt data={currentOrder} />
                            </CardContent>
                        )}
                    </Card>
                )}
                <Card className="w-full sticky bottom-0">
                    <CardContent className="flex flex-col">
                        <div>
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
                            </div>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                            <Button onClick={() => handleAddOrder()}>Crear orden</Button>
                            {currentOrder?.order && (
                                <div className="flex gap-2">
                                    <Badge variant="outline">
                                        #{currentOrder.order.position} | {formatPrice(currentOrder.order.total)}
                                    </Badge>
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
                            )}
                        </div>
                    </CardContent>
                </Card>
            </footer>
        </div>
    );
}
