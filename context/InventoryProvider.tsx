'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import useSWR from 'swr';
import { addNewItemAction, toggleItemStatusAction, removeItemAction, addTransactionAction, deleteTransactionAction } from '@/app/actions';
import { InventoryItemsTable, TransactionsTable } from '@/lib/sql/types';
import { Selectable } from 'kysely';

export type Item = Selectable<InventoryItemsTable>
export type Transaction = Selectable<TransactionsTable>

interface InventoryContextProps {
  items: Item[];
  transactions: Transaction[];
  selectedItem: Item | null;
  setSelectedItem: (item: Item | null) => void;
  addItem: (formData: FormData) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  toggleItem: (item: Item) => Promise<void>;
  addTransaction: (formData: FormData) => Promise<void>;
  deleteTransaction: (formData: FormData) => Promise<void>;
}

const InventoryContext = createContext<InventoryContextProps | undefined>(undefined);

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: items, mutate: mutateItems } = useSWR<Item[]>('/api/inventory/items', fetcher, {
    revalidateOnFocus: false,
  });
  const [selectedItem, setSelectedItemState] = useState<Item | null>(null);

  const { data: transactions, mutate: mutateTransactions } = useSWR<Transaction[]>(
    selectedItem ? `/api/inventory/transactions?itemId=${selectedItem.id}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  const setSelectedItem = (item: Item | null) => {
    setSelectedItemState(item);
    mutateTransactions(); // Fetch transactions for the newly selected item
  };

  const addItem = async (formData: FormData) => {
    const itemsIds = new Set(items?.map(({ id }) => id));
    await addNewItemAction(formData);
    await mutateItems();
    const newItem = items?.find(item => itemsIds.has(item.id)) || null;
    setSelectedItem(newItem);
  };

  const deleteItem = async (id: string) => {
    const formData = new FormData();
    formData.append('id', id);
    await removeItemAction(formData);
    mutateItems();
    if (selectedItem && selectedItem.id === id) {
      setSelectedItem(null); // Deselect item if it was deleted
    }
  };


  const toggleItem = async (item: Item) => {
    const formData = new FormData();
    formData.append('id', item.id);
    await toggleItemStatusAction(formData);
    await mutateItems();
    if (item && item.status === 'pending') {
      item.status = 'completed';
      setSelectedItem(item);
      mutateTransactions();
    }
  };

  const addTransaction = async (formData: FormData) => {
    await addTransactionAction(formData);
    mutateTransactions();
  };

  const deleteTransaction = async (formData: FormData) => {
    await deleteTransactionAction(formData);
    mutateTransactions();
  };

  return (
    <InventoryContext.Provider
      value={{
        items: items || [],
        transactions: transactions || [],
        selectedItem,
        setSelectedItem,
        addItem,
        deleteItem,
        toggleItem,
        addTransaction,
        deleteTransaction,
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
