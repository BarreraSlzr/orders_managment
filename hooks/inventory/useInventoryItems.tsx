import { addNewItemAction, toggleItemStatusAction, removeItemAction } from '@/app/actions';
import { InventoryItemsTable } from '@/lib/sql/types';
import { fetcher } from "@/lib/utils/fetcher";
import { Selectable } from 'kysely';
import { useState } from "react";
import useSWR from "swr";
import { Category } from './useCategories';

export type Item = Selectable<InventoryItemsTable>

export const useItems = (selectedCategory?: Pick<Category, 'id'> | null) => {
    const { data: items, mutate: mutateItems } = useSWR<Item[]>(
        `/api/inventory/items${selectedCategory?.id ? `?category=${selectedCategory.id}` : ''}`, 
        fetcher, {
        revalidateOnFocus: true,
    });
    const [selectedItem, setSelectedItemState] = useState<Item | null>(null);


    const addItem = async (formData: FormData) => {
        const itemsIds = new Set(items?.map(({ id }) => id));
        if(selectedCategory?.id){
            formData.append('categoryId', selectedCategory.id);
        }
        await addNewItemAction(formData);
        await mutateItems();
        const newItem = items?.find(item => itemsIds.has(item.id)) || null;
        setSelectedItemState(newItem);
    };

    const deleteItem = async (id: string) => {
        const formData = new FormData();
        formData.append('id', id);
        await removeItemAction(formData);
        mutateItems();
        if (selectedItem && selectedItem.id === id) {
            setSelectedItemState(null);
        }
    };

    const toggleItem = async (item: Item) => {
        const formData = new FormData();
        formData.append('id', item.id);
        await toggleItemStatusAction(formData);
        await mutateItems();
        if (item && item.status === 'pending') {
            item.status = 'completed';
            setSelectedItemState(item);
        }
    };

    return {
        items: items || [],
        selectedItem,
        setSelectedItem: setSelectedItemState,
        addItem,
        deleteItem,
        toggleItem,
    }
};