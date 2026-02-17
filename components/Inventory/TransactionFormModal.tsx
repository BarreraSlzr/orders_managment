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
import { measureTypes } from "@/lib/utils/measureTypes";
import { AnimatePresence } from "motion/react";
import React from "react";
import { ListItem } from "./ItemList";
import { TransactionHistory } from "./TransactionHistory";

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
        <TransactionHistory
          transactions={transactions}
          onDelete={handleDelete}
        />
      </DialogContent>
    </Dialog>
  );
}
