
import { removeCategoryAction, updateCategoryAction } from "@/app/actions";
import { CategoriesTable } from "@/lib/sql/types";
import { fetcher } from "@/lib/utils/fetcher";
import { Selectable } from "kysely";
import { useState } from 'react';
import useSWR from "swr";

export type Category = Selectable<CategoriesTable>;

export const useCategories = () => {
    const { data: categories, mutate: mutateCategories } = useSWR<Category[]>('/api/inventory/categories', fetcher, {
        revalidateOnFocus: false,
    });
    const [selectedCategory, setSelectedCategoryState] = useState<Category | null>(null);

    const deleteCategory = async (id: string) => {
        const formData = new FormData();
        formData.append('id', id);
        await removeCategoryAction(formData);
        mutateCategories();
        if (selectedCategory && selectedCategory.id === id) {
            setSelectedCategoryState(null);
        }
    };

    const updateCategory = async (formData: FormData) => {
        if( selectedCategory?.id ){
            formData.append('id', selectedCategory.id)
        }
        await updateCategoryAction(formData);
        mutateCategories();
    };

    return {
        categories: categories || [],
        selectedCategory,
        setSelectedCategory: setSelectedCategoryState,
        deleteCategory,
        updateCategory,
    }
};