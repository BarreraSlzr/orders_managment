

import React from 'react';
import { Plus, Search } from 'lucide-react';
import { useTodoList } from '@/context/TodoListProvider';

export default function AddItemForm() {
  const {
    useItemText: [newItemText, setNewItemText],
    addItem,
    suggestions,
    selectSuggestion,
    inputRef,
  } = useTodoList();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        addItem();
      }}
      className="relative mb-4"
    >
      <div className="flex">
        <input
          ref={inputRef}
          type="text"
          value={newItemText}
          name='name'
          id='id'
          onChange={(e) => setNewItemText(e.target.value)}
          placeholder="Agrega o busca inventario"
          className="flex-grow p-2 pl-8 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
        <button
          type="submit"
          className="bg-yellow-400 p-2 rounded-r-md hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-600"
          aria-label="Add item"
        >
          <Plus className="w-6 h-6 text-gray-800" />
        </button>
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