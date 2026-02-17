"use client";

import React, { useEffect, useState } from "react";
import AddItemForm from "./AddItemForm";
import ItemList from "./ItemList";
import { InventoryProvider, useInventory } from "@/context/InventoryProvider";
import { ChevronDown, ChevronUp } from "lucide-react";
import { TransactionFormModal } from "./TransactionFormModal";
import { CategorizedCardList } from "./Categories";
import { TransactionHistory } from "./TransactionHistory";

function TodoListContent() {
  const {
    selectedCategory,
    selectedItem,
    transactions,
    deleteTransaction,
  } = useInventory();
  const [showCompleted, setShowCompleted] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setModalOpen(!!selectedItem);
  }, [selectedItem]);

  const handleDelete = async (transactionId: number) => {
    const formData = new FormData();
    formData.set("id", String(transactionId));
    await deleteTransaction(formData);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4 text-gray-800">
        Inventario {!!selectedCategory?.id && ` de ${selectedCategory.name}`}
      </h1>
      <AddItemForm />
      <div className="space-y-4">
        <section aria-labelledby="unchecked-items">
          <h2
            id="unchecked-items"
            className="text-lg font-semibold mb-2 text-gray-700"
          >
            Pendiente
          </h2>
          <ItemList status={"pending"} />
        </section>
        <section aria-labelledby="checked-items">
          <h2
            id="checked-items"
            className="text-lg font-semibold mb-2 text-gray-700 flex items-center"
          >
            Completado
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="ml-2 text-yellow-600 hover:text-yellow-700 focus:outline-none"
              aria-label={
                showCompleted
                  ? "Oculta inventario completado"
                  : "Muestra inventario completado"
              }
            >
              {showCompleted ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>
          </h2>
          {showCompleted && <ItemList status={"completed"} />}
        </section>
        <section
          aria-labelledby="transaction-history"
          className="rounded-xl border bg-white/80 p-4"
        >
          <h2
            id="transaction-history"
            className="text-lg font-semibold text-gray-700"
          >
            Movimientos recientes
          </h2>
          {selectedItem ? (
            <TransactionHistory
              transactions={transactions}
              onDelete={handleDelete}
              title={`Historial de ${selectedItem.name}`}
            />
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Selecciona un item para ver su historial.
            </p>
          )}
        </section>
      </div>
      {selectedItem && (
        <TransactionFormModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          item={selectedItem}
        />
      )}
    </div>
  );
}

export default function TodoListPage() {
  return (
    <InventoryProvider>
      <div className="p-4 bg-slate-50 min-h-screen flex flex-col md:flex-row flex-wrap gap-8">
        <div>
          <CategorizedCardList />
        </div>
        <div className="flex-grow">
          <TodoListContent />
        </div>
      </div>
    </InventoryProvider>
  );
}
