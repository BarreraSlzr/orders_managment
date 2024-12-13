import { Button } from '@/components/ui/button';
import { Minus, Plus } from 'lucide-react';
import { useOrderItemsProducts } from '@/context/useOrderItemsProducts';
import { useOrders } from '@/context/useOrders';
import { Product } from '@/lib/types';

interface Props {
  product: Product
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
