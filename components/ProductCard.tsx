import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Minus, Plus } from 'lucide-react';
import { Product } from '@/lib/types';
import { formatPrice } from '@/lib/utils/formatPrice';
import { useOrderItemsProducts } from '@/context/useOrderItemsProducts';
import { PropsWithChildren, useEffect, useState } from 'react';
import { useOrders } from '@/context/useOrders';
import { useProducts } from '@/context/useProducts';
import { Badge } from './ui/badge';
import { useProductsFilter } from '@/context/useProductsFilter';

const LONG_PRESS_DURATION = 500 // ms

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
      className='min-w-60 overflow-hidden cursor-pointer touch-auto'>
      <CardContent className="p-4 select-none flex flex-row flex-wrap gap-2">
          <p className="font-semibold">{product.name}</p>
          { product.tags.split(',').map((tag) => <Badge key={tag} variant={selectedTags.has(tag) ? 'default' : 'secondary'} className='opacity-30'>{tag}</Badge>)}
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

export function OrderControls({ product }: Props) {
  const {
    handleAddOrder,
    handleUpdateOrderItems
  } = useOrderItemsProducts();
  const { isPending, currentOrder } = useOrders()
  const productInOrder = currentOrder?.products.find(product_item => product_item.product_id === product.id);

  if (currentOrder) {
    return productInOrder ? (
      <div className="inline-flex items-center rounded-md border border-input bg-background shadow-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleUpdateOrderItems(product.id, "DELETE")}
          disabled={productInOrder.items.length === 0 || isPending}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <div className="w-8 h-8 flex items-center justify-center">{productInOrder.items.length}</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleUpdateOrderItems(product.id, "INSERT")}
          disabled={isPending}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    ) : (
      <Button
        size="sm"
        onClick={() => handleUpdateOrderItems(product.id, "INSERT")}
        disabled={isPending}
      >
        Agregar
      </Button>
    );
  } else {
    return (
      <Button
        size="sm"
        onClick={() => handleAddOrder(product.id)}
        disabled={isPending}
      >
        Crear orden
      </Button>
    );
  }
};
