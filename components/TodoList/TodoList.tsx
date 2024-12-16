"use client";

import React, { useState } from 'react';
import AddItemForm from './AddItemForm';
import ItemList from './ItemList';
import {  TodoListProvider } from '@/context/TodoListProvider';
import { ChevronDown, ChevronUp } from 'lucide-react';

function TodoListContent() {
  const [showCompleted, setShowCompleted] = useState(false);

  return (
    <div className="max-w-md mx-auto p-4 bg-slate-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Inventario</h1>
      <AddItemForm />
      <div className="space-y-4">
        <section aria-labelledby="unchecked-items">
          <h2 id="unchecked-items" className="text-lg font-semibold mb-2 text-gray-700">Pendiente</h2>
          <ItemList status={'pending'} />
        </section>
        <section aria-labelledby="checked-items">
          <h2 id="checked-items" className="text-lg font-semibold mb-2 text-gray-700 flex items-center">
            Completado
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="ml-2 text-yellow-600 hover:text-yellow-700 focus:outline-none"
              aria-label={showCompleted ? "Oculta inventario completado" : "Muestra inventario completado"}
            >
              {showCompleted ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </h2>
          {showCompleted && <ItemList status={'completed'} />}
        </section>
      </div>
    </div>
  );
}

export default function TodoListPage() {
  return (
    <TodoListProvider>
      <TodoListContent />
    </TodoListProvider>
  );
}
