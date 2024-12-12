'use client'

import { OrderControls, ProductCard } from '@/components/ProductCard';
import { OpenOrderSheet } from './sheets/Orders';
import { TagsSheet } from './sheets/Tags';
import { useProductsFilter } from '@/context/useProductsFilter';
import { Badge } from './ui/badge';
import { colorsByIndex } from './FilterControls';
import { ShowCurrentProductForm } from './Products/form';
import EmptyState from './Products/EmptyState';

export default function ProductOrderManagment() {
    const { visibleProducts, visibleTags, selectedTags, handleTagToggle } = useProductsFilter();

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col justify-between">
            <main className='p-4 pb-10 flex flex-wrap gap-2'>
                {selectedTags.size > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {visibleTags.map(([tag, id]) => (
                            <Badge
                                key={tag}
                                className={`${colorsByIndex[id]} ${selectedTags.has(tag) ? 'bg-black' : ''}`}
                                onClick={() => handleTagToggle(tag)}
                            >{tag}</Badge>
                        ))}
                    </div>
                )}
                {visibleProducts.map(product => (
                    <div key={product.id} className='flex-grow'>
                        <ProductCard product={product}>
                            <OrderControls product={product} />
                        </ProductCard>
                    </div>
                ))}
                { visibleProducts.length === 0 && <EmptyState/>}
            </main>
            <div className="sticky bottom-14 p-4 flex justify-between items-end">
                <ShowCurrentProductForm />
            </div>
            <div className="sticky bottom-0 p-4 flex justify-between items-end">
                <TagsSheet />
                <OpenOrderSheet />
            </div>
        </div>
    );
};