'use client'

import { OpenOrderSheet } from './sheets/Orders';
import { TagsSheet } from './sheets/Tags';
import { useProductsFilter } from '@/context/useProductsFilter';
import { ProductForm } from './Products/Form';
import EmptyState from './Products/EmptyState';
import { useProducts } from '@/context/useProducts';
import { Product } from '@/lib/types';
import TagList from './Tag/List';
import { ListProducts } from './Products/List';

export default function ProductOrderManagment() {
    const { visibleProducts, selectedTags, visibleTags } = useProductsFilter();

    return (
        <main className="min-h-screen bg-slate-100 flex flex-col justify-between p-4 gap-8">
            {selectedTags.size > 0 && <TagList tags={visibleTags} />}
            {visibleProducts.length === 0 && <div className="p-4"><EmptyState /></div>}
            <ListProducts products={visibleProducts} />
            <Actions />
        </main>
    );
};

const Actions = () => {
    const { currentProduct } = useProducts();
    if (currentProduct) return <div className="fixed backdrop-blur-sm bg-slate-400/30 bottom-0 left-0 h-screen w-screen flex items-center">
            <ProductForm product={currentProduct as Product} /> 
    </div>
    return (
        <div className="sticky bottom-4 flex justify-between items-end">
            <TagsSheet />
            <OpenOrderSheet />
        </div>
    )
}