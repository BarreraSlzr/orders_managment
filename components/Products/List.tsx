import { Product } from '@/lib/types';
import * as React from 'react';
import { OrderControls } from './OrderActions';
import { ProductCard } from './Card';

export interface IListProductsProps {
    products: Product[]
}

export function ListProducts({ products }: IListProductsProps) {
    return (
        <div className='flex flex-wrap gap-2'>
            {products.map(product =>
                <ProductCard key={product.id} product={product}>
                    <OrderControls product={product} />
                </ProductCard>
            )}
        </div>
    );
}
