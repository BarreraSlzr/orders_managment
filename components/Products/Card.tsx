'use client'
import { PropsWithChildren, useState, useEffect } from "react";
import { useProducts } from "@/context/useProducts";
import { formatPrice } from "@/lib/utils/formatPrice";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Product } from "@/lib/types";
import { useProductsFilter } from "@/context/useProductsFilter";
import { Badge } from "../ui/badge";

const LONG_PRESS_DURATION = 3000 // ms
const VIBRATION_DURATION = 100 // ms


interface Props {
    product: Product
}

export function ProductCard({
    product,
    children: actions }: PropsWithChildren<Props>) {
    const { handleEditProduct } = useProducts();
    const { selectedTags } = useProductsFilter();
    const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null)
    const startPress = () => {
        const start = new Date().getTime()
        const detectLongPress = () => {
            const now = new Date().getTime()
            if (now - start >= LONG_PRESS_DURATION) {
                if (navigator.vibrate) {
                    navigator.vibrate(VIBRATION_DURATION);
                }
                handleEditProduct(product)
            }
        }
        setPressTimer(setTimeout(detectLongPress, LONG_PRESS_DURATION))
    }

    const endPress = () => {
        if (pressTimer) {
            clearTimeout(pressTimer)
            setPressTimer(null)
        }
    }

    useEffect(() => {
        return () => {
            if (pressTimer) {
                clearTimeout(pressTimer)
            }
        }
    }, [pressTimer])

    return (
        <Card
            onMouseDown={startPress}
            onMouseUp={endPress}
            onMouseLeave={endPress}
            onTouchStart={startPress}
            onTouchEnd={endPress}
            className='min-w-60 overflow-hidden cursor-pointer touch-auto flex-grow'>
            <CardContent className="p-4 select-none flex flex-row flex-wrap gap-2">
                <p className="font-semibold">{product.name}</p>
                {product.tags.split(',').map((tag) => <Badge key={tag} variant={selectedTags.has(tag) ? 'default' : 'secondary'} className='opacity-30'>{tag}</Badge>)}
            </CardContent>
            <CardFooter className="px-4 py-2 bg-gray-100 flex justify-between select-none">
                <p className="text-sm text-bold font-mono">{formatPrice(product.price)}</p>
                <div className=''>
                    {actions}
                </div>
            </CardFooter>
        </Card>
    );
}