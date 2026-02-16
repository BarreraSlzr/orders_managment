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
import { AnimatePresence } from "framer-motion";
import React from "react";
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
  const { addTransaction, selectedItem } = useInventory();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    formData.append("itemId", item.id);
    await addTransaction(formData);
    onClose();
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
            <Label htmlFor="quantity" className="text-right">
              Cantidad
            </Label>
            <Input
              id="quantity"
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
            <Select required>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Selecciona una unidad" />
              </SelectTrigger>
              <SelectContent>
                {item.quantity_type_key &&
                  measureTypes[
                    item.quantity_type_key as keyof typeof measureTypes
                  ].map((value) => (
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
            <Button type="submit">Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
