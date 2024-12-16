'use client';

import React, { createContext, Dispatch, RefObject, SetStateAction, useContext, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { addNewItem, toggleItemStatus, removeItem } from '@/app/actions';
import { Item as DBItem } from '@/lib/sql/types';
import { Selectable } from 'kysely';

export type Item = Selectable<DBItem>

interface TodoListContextProps {
  items: Item[];
  addItem: () => Promise<void>;
  toggleItem: (id: Item['id']) => Promise<void>;
  deleteItem: (id: Item['id']) => Promise<void>;
  selectSuggestion: (item: Item) => void;
  suggestions: Item[],
  inputRef: RefObject<HTMLInputElement>,
  useItemText: [Item['name'], Dispatch<SetStateAction<Item['name']>>]
}

const TodoListContext = createContext<TodoListContextProps | undefined>(undefined);

const fetcher = (url: string): Promise<Item[]> => fetch(url).then((res) => res.json());

export const TodoListProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: items, mutate } = useSWR<Item[]>('/api/items', fetcher, {
    revalidateOnFocus: false,
  });
  const [newItemText, setNewItemText] = useState('');
  const [suggestions, setSuggestions] = useState<Item[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (newItemText.trim() && items) {
      const filtered = items.filter(item => item.name.toLowerCase().includes(newItemText.toLowerCase()));
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [newItemText, items]);


  const selectSuggestion = (item: Item) => {
    setNewItemText(item.name);
    setSuggestions([]);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <TodoListContext.Provider
      value={{
        items: items || [],
        suggestions,
        selectSuggestion,
        inputRef,
        useItemText: [newItemText, setNewItemText],
        async addItem() {
          if (newItemText.trim()) {
            const formData = new FormData();
            formData.append('name', newItemText.trim());
            await addNewItem(formData);
            mutate();
            setNewItemText('');
            setSuggestions([]);
          }
        },
        async toggleItem(id) {
          const formData = new FormData();
          formData.append('id', id);
          await toggleItemStatus(formData);
          mutate();
        },
        async deleteItem(id) {
          const formData = new FormData();
          formData.append('id', id);
          await removeItem(formData);
          mutate();
        },
      }}
    >
      {children}
    </TodoListContext.Provider>
  );
};

export const useTodoList = (): TodoListContextProps => {
  const context = useContext(TodoListContext);
  if (!context) {
    throw new Error('useTodoList must be used within a TodoListProvider');
  }
  return context;
};
