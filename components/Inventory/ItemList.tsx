"use client";

import { useInventory } from "@/context/InventoryProvider";
import { Item } from "@/hooks/inventory/useInventoryItems";
import { Trash2 } from "lucide-react";
import { Badge } from "../ui/badge";
import { AnimatePresence, motion } from "motion/react";

export function ListItem({ item }: { item: Item }) {
  const { toggleItem, deleteItem } = useInventory();

  return (
    <motion.li
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center bg-white p-3 rounded-md shadow"
    >
      <input
        type="checkbox"
        checked={item.status === "completed"}
        onChange={() => toggleItem(item)}
        className="mr-3 form-checkbox h-5 w-5 text-yellow-500 rounded focus:ring-yellow-400"
      />
      <div className="flex flex-1 items-center gap-2">
        <span
          className={`flex-grow ${
            item.status === "completed"
              ? "line-through text-gray-500"
              : "text-gray-800"
          }`}
        >
          {item.name}
        </span>
        {!item.hasCategory && (
          <Badge variant="secondary" className="text-[10px]">
            Sin categoria
          </Badge>
        )}
      </div>
      <button
        onClick={() => deleteItem(item.id)}
        className="ml-2 text-gray-500 hover:text-red-500 focus:outline-none"
        aria-label="Delete item"
      >
        <Trash2 className="w-5 h-5" />
      </button>
    </motion.li>
  );
}

export default function ItemList({ status }: Pick<Item, "status">) {
  const { items } = useInventory();
  const filteredItems = items.filter((item) => item.status === status);

  return (
    <ul className="space-y-2">
      <AnimatePresence>
        {filteredItems.map((item) => (
          <ListItem key={item.id} item={item} />
        ))}
      </AnimatePresence>
    </ul>
  );
}
