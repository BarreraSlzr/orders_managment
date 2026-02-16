'use client'

import { useProducts } from '@/context/useProducts';
import { useProductsFilter } from '@/context/useProductsFilter';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { Product } from '@/lib/types';
import { useState } from 'react';
import { AdminSettingsPanel } from './Admin/AdminSettingsPanel';
import EmptyState from './Products/EmptyState';
import { ProductForm } from './Products/Form';
import { ListProducts } from './Products/List';
import { OpenOrderSheet } from './sheets/Orders';
import { TagsSheet } from './sheets/Tags';
import TagList from './Tag/List';

export default function ProductOrderManagment() {
    const { visibleProducts, selectedTags, visibleTags } = useProductsFilter();
    const { isAdmin } = useAdminStatus();
    const [settingsOpen, setSettingsOpen] = useState(false);

    return (
        <main className="min-h-screen bg-slate-100 flex flex-col justify-between p-4 gap-8">
            {isAdmin && (
                <button
                    type="button"
                    className="fixed top-3 right-3 z-40 rounded-full bg-white/80 p-2 text-slate-500 shadow hover:bg-white hover:text-slate-800 transition"
                    onClick={() => setSettingsOpen(true)}
                    aria-label="Admin settings"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                </button>
            )}
            {settingsOpen && <AdminSettingsPanel onClose={() => setSettingsOpen(false)} />}
            {selectedTags.size > 0 && <TagList tags={visibleTags} />}
            {visibleProducts.length === 0 && <div className="p-4"><EmptyState /></div>}
            <ListProducts products={visibleProducts} />
            <Actions />
        </main>
    );
};

const Actions = () => {
    const { currentProduct } = useProducts();
    if (currentProduct) return <div className="fixed bottom-0 left-0 h-screen w-screen backdrop-blur-sm bg-slate-400/30 p-4 flex items-center">
            <ProductForm product={currentProduct as Product} /> 
    </div>
    return (
        <div className="sticky bottom-4 flex justify-between items-end">
            <TagsSheet />
            <OpenOrderSheet />
        </div>
    )
}