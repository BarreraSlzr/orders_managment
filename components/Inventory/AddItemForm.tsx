

import React, { useEffect, useRef, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useInventory } from '@/context/InventoryProvider';
import { measureTypes } from '@/lib/utils/measureTypes';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import { Item } from '@/hooks/inventory/useInventoryItems';

export default function AddItemForm() {
  const { addItem, items} = useInventory();
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

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newItemText.trim()) {
      const formData = new FormData(e.currentTarget as HTMLFormElement)
      await addItem(formData)
      setNewItemText('')
      setSuggestions([])
    }
  }


  return (
    <form onSubmit={handleAddItem} className="relative mb-4">
        <div className="flex">
          <Input
            ref={inputRef}
            type="text"
            name="name"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            placeholder="Agrega o busca inventario"
            className="flex-grow p-2 pl-8 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-yellow-400"
            required
          />
          <Select name="quantity_type_key" required>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="📏" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(measureTypes).map((key) => (
                <SelectItem key={key} value={key}>
                  {key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" className="bg-yellow-400 p-2 rounded-r-md hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-600">
            <Plus className="w-6 h-6 text-gray-800" />
          </Button>
        </div>
        <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" aria-hidden="true" />
        {suggestions.length > 0 && (
          <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-60 overflow-auto">
            {suggestions.map(item => (
              <li
                key={item.id}
                onClick={() => selectSuggestion(item)}
                className="p-2 hover:bg-yellow-100 cursor-pointer"
              >
                {item.name}
              </li>
            ))}
          </ul>
        )}
      </form>
  );
}