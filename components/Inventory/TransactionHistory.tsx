"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Transaction } from "@/hooks/inventory/useTransactions";
import { formatDate } from "@/lib/utils/formatDate";
import { formatPrice } from "@/lib/utils/formatPrice";
import { Trash2 } from "lucide-react";
import React from "react";

interface TransactionHistoryProps {
  transactions: Transaction[];
  onDelete?: (id: number) => void | Promise<void>;
  title?: string;
}

export function TransactionHistory({
  transactions,
  onDelete,
  title = "Historial de movimientos",
}: TransactionHistoryProps) {
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");

  const filtered = React.useMemo(() => {
    return transactions.filter((transaction) => {
      if (typeFilter !== "all" && transaction.type !== typeFilter) {
        return false;
      }

      const transactionDate = transaction.created.toLocaleDateString("en-CA");

      if (dateFrom && transactionDate < dateFrom) {
        return false;
      }

      if (dateTo && transactionDate > dateTo) {
        return false;
      }

      return true;
    });
  }, [transactions, typeFilter, dateFrom, dateTo]);

  return (
    <div className="border-t pt-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="text-sm font-semibold text-gray-700">{title}</div>
        <ToggleGroup
          type="single"
          value={typeFilter}
          onValueChange={(value) => setTypeFilter(value || "all")}
          className="justify-start"
        >
          <ToggleGroupItem value="all" aria-label="Mostrar todo">
            Todos
          </ToggleGroupItem>
          <ToggleGroupItem value="IN" aria-label="Mostrar entradas">
            Entrada
          </ToggleGroupItem>
          <ToggleGroupItem value="OUT" aria-label="Mostrar salidas">
            Salida
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="space-y-1">
          <label className="text-xs text-slate-500" htmlFor="date-from">
            Desde
          </label>
          <Input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500" htmlFor="date-to">
            Hasta
          </label>
          <Input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setTypeFilter("all");
              setDateFrom("");
              setDateTo("");
            }}
          >
            Limpiar filtros
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Sin movimientos registrados.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {filtered.map((transaction) => (
            <li
              key={transaction.id}
              className="rounded-lg border bg-white p-3 text-xs shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    transaction.type === "IN"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {transaction.type === "IN" ? "Entrada" : "Salida"}
                </span>
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(transaction.id)}
                    className="text-slate-400 hover:text-rose-500"
                    aria-label="Eliminar movimiento"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="mt-2 flex flex-col gap-1 text-slate-600">
                <span>
                  {transaction.quantity} {transaction.quantity_type_value}
                </span>
                <span>{formatPrice(transaction.price)}</span>
                <span className="text-[10px] text-slate-400">
                  {formatDate(transaction.created)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
