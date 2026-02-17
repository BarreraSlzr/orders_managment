import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInventory } from "@/context/InventoryProvider";
import { Item } from "@/hooks/inventory/useInventoryItems";
import { formatDate } from "@/lib/utils/formatDate";
import { formatPrice } from "@/lib/utils/formatPrice";
import { measureTypes } from "@/lib/utils/measureTypes";
import { AnimatePresence } from "motion/react";
import React from "react";
import { Trash2 } from "lucide-react";
import { ListItem } from "./ItemList";

interface ItemDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item;
}

export function TransactionFormModal({
  isOpen,
  onClose,
  item,
}: ItemDetailsModalProps) {
  const {
    addTransaction,
    deleteTransaction,
    selectedItem,
    transactions,
  } = useInventory();
  const [type, setType] = React.useState<"IN" | "OUT">("IN");
  const [quantityTypeValue, setQuantityTypeValue] = React.useState("");
  const unitOptions = React.useMemo(
    () =>
      item.quantity_type_key
        ? measureTypes[item.quantity_type_key as keyof typeof measureTypes]
        : [],
    [item.quantity_type_key],
  );

  React.useEffect(() => {
    setQuantityTypeValue(unitOptions[0] ?? "");
  }, [item.quantity_type_key, unitOptions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    formData.append("itemId", item.id);
    formData.set("type", type);
    formData.set("quantityTypeValue", quantityTypeValue);
    if (!quantityTypeValue) return;
    await addTransaction(formData);
    onClose();
  };

  const handleDelete = async (transactionId: number) => {
    const formData = new FormData();
    formData.set("id", String(transactionId));
    await deleteTransaction(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Detalles de inventario</DialogTitle>
        </DialogHeader>
        {selectedItem && <ListItem item={selectedItem} />}
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="type" className="text-right">
              Movimiento
            </Label>
            <Select
              value={type}
              onValueChange={(value) => setType(value as "IN" | "OUT")}
            >
              <SelectTrigger id="type" className="col-span-3">
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IN">Entrada</SelectItem>
                <SelectItem value="OUT">Salida</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="quantity" className="text-right">
              Cantidad
            </Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              className="col-span-3"
              defaultValue={1}
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="quantityTypeValue" className="text-right">
              Unidad
            </Label>
            <Select
              value={quantityTypeValue}
              onValueChange={setQuantityTypeValue}
              required
              disabled={unitOptions.length === 0}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Selecciona una unidad" />
              </SelectTrigger>
              <SelectContent>
                {unitOptions.map((value) => (
                  <AnimatePresence key={value}>
                    <SelectItem value={value}>{value}</SelectItem>
                  </AnimatePresence>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="price" className="text-right">
              Price
            </Label>
            <Input
              id="price"
              name="price"
              type="number"
              defaultValue={1}
              className="col-span-3"
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!quantityTypeValue}>
              Guardar
            </Button>
          </DialogFooter>
        </form>
        <div className="border-t pt-4">
          <div className="text-sm font-semibold text-gray-700">
            Historial de movimientos
          </div>
          {transactions.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Sin movimientos registrados.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {transactions.map((transaction) => (
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
                    <button
                      type="button"
                      onClick={() => handleDelete(transaction.id)}
                      className="text-slate-400 hover:text-rose-500"
                      aria-label="Eliminar movimiento"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
      </DialogContent>
    </Dialog>
  );
}
