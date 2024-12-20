'use client';

import React, { createContext, useContext } from 'react';
import { Item, useItems } from '@/hooks/inventory/useInventoryItems';
import { Transaction, useTransactions } from '@/hooks/inventory/useTransactions';
import { Category, useCategories } from '@/hooks/inventory/useCategories';


interface InventoryContextProps {
  items: Item[];
  transactions: Transaction[];
  categories: Category[];
  selectedItem: Item | null;
  selectedCategory: Category | null;
  setSelectedItem: (item: Item | null) => void;
  setSelectedCategory: (category: Category | null) => void;
  addItem: (formData: FormData) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  toggleItem: (item: Item) => Promise<void>;
  addTransaction: (formData: FormData) => Promise<void>;
  deleteTransaction: (formData: FormData) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  updateCategory: (formData: FormData) => Promise<void>;
}

const InventoryContext = createContext<InventoryContextProps | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { selectedCategory, ...apiCategories } = useCategories();
  const { items, selectedItem, ...apiItems } = useItems(selectedCategory);
  const apiTransactions = useTransactions(selectedItem);
  
  return (
    <InventoryContext.Provider
      value={{
        items: items || [],
        selectedItem,
        selectedCategory,
        ...apiCategories,
        ...apiItems,
        ...apiTransactions,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = (): InventoryContextProps => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useTodoList must be used within a TodoListProvider');
  }
  return context;
};
