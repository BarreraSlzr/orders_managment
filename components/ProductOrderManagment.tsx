'use client'

import { FilterControls } from '@/components/FilterControls';
import { ProductCard } from '@/components/ProductCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOrders } from '@/hooks/useOrders';
import { formatPrice } from '@/lib/utils/formatPrice';
import { X } from 'lucide-react';
import { Product, Order } from '@/lib/types';

export default function ProductOrderManagment({ products: p, orders: os }: {
    products: Product[],
    orders: Order[]
}) {
    const {
        isPending,
        currentOrder,
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
    } = useOrders({ products: p, orders: os });

    return (
        <div className="max-w-md mx-auto space-y-4 h-screen">
            <header className="flex justify-between items-center">
                <Button className='whitespace-nowrap' onClick={() => handleAddOrder()}>Crear orden</Button>
                {currentOrder && <>
                    <div className="flex gap-2">
                        <Badge variant="outline">#{currentOrder.order.position} | {formatPrice(currentOrder.order.total)}</Badge>
                        <Button variant='destructive' size="sm" disabled={isPending} onClick={() => handleCloseOrder()}>Cerrar orden</Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setCurrentOrderDetails(null)}
                        >
                            <X />
                        </Button>
                    </div>
                </>
                }
            </header>
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
            {/* <footer className="sticky bottom-0 translate-y-2 pb-2 max-w-md w-full">
                {!!currentOrder?.items &&
                    <Card className='py-4 translate-y-8'>
                        <CardHeader className='pt-1 px-4'>
                            <Button variant='ghost' size='sm' onClick={toggleDetail}>
                                <b> Productos seleccionados ({[currentOrder.items.values()].reduce((acc, its) => acc + its.toArray().reduce((acc2, its) => acc2 + its.quantity, 0), 0)})</b>
                                {
                                    showDetail ?
                                        <ArrowDown />
                                        :
                                        <ArrowUp />
                                }
                            </Button>
                        </CardHeader>
                        {showDetail &&
                            <CardContent className='flex flex-col' >
                                {products
                                    .filter(p => currentOrder?.items.has(p.id))
                                    .map(product => <ProductCard
                                        key={product.id}
                                        product={product}
                                        currentOrder={currentOrder}
                                        handleAddOrder={handleAddOrder}
                                        handleUpdateOrderItems={handleUpdateOrderItems}
                                        isPending={isPending} />
                                    )
                                }
                            </CardContent>
                        }
                    </Card>}
                <Card className='w-full sticky bottom-0'>
                    <CardContent className='flex flex-col'>
                        <div>
                            <div className="flex flex-wrap gap-2 py-2">
                                {Array.from(orders.values()).map(order => (
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
                        <div className='flex justify-between items-center gap-2'>
                            <Button onClick={() => handleAddOrder()}>Crear orden</Button>
                            {currentOrder?.order && (
                                <div className="flex gap-2">
                                    <Badge variant="outline">#{currentOrder.order.position} | {formatPrice(currentOrder.order.total)}</Badge>
                                    <Button variant="destructive" size="sm" disabled={isPending} onClick={handleCloseOrder}>
                                        Cerrar orden
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => setCurrentOrderDetails(null)}>
                                        <X />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </footer> */}
        </div>
    );
}
