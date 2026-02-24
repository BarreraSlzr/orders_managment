"use client";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TEST_IDS, tid } from "@/lib/testIds";
import { useTRPC } from "@/lib/trpc/react";
import { centsToMxDisplay, parseCurrencyToCents } from "@/lib/utils/currency";
import { measureTypes } from "@/lib/utils/measureTypes";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronLeft, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ItemSelectorResult {
  itemId: string;
  itemName: string;
  quantityTypeKey: string;
  quantity: number;
  unit: string;
  price: number;
}

interface ItemSelectorProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (params: ItemSelectorResult) => void | Promise<void>;
  title?: string;
}

export interface ItemSelectorContentProps {
  title?: string;
  onConfirm: (params: ItemSelectorResult) => void | Promise<void>;
  onCancel: () => void;
  /** When provided, skip straight to the details step pre-filled for editing. */
  initialValues?: {
    itemId: string;
    itemName: string;
    quantity: number;
    unit: string;
    price: number;
  };
}

type Step = "search" | "details";

// ── ItemSelectorContent — embeddable body+footer, no Drawer shell ─────────────

export function ItemSelectorContent({
  title = "Agregar ingrediente",
  onConfirm,
  onCancel,
  initialValues,
}: ItemSelectorContentProps) {
  const trpc = useTRPC();

  // Remote data
  const { data: rawItems, refetch: refetchItems } = useQuery(
    trpc.inventory.items.list.queryOptions(),
  );
  const items = rawItems ?? [];
  type InventoryRow = NonNullable<typeof rawItems>[number];
  const addItemMutation = useMutation(
    trpc.inventory.items.add.mutationOptions(),
  );

  // Local state — pre-filled from initialValues when editing
  const [step, setStep] = useState<Step>(initialValues ? "details" : "search");
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<InventoryRow | null>(null);
  const [newQuantityTypeKey, setNewQuantityTypeKey] = useState("");

  // Details step fields
  const [quantity, setQuantity] = useState<number>(
    initialValues?.quantity ?? 1,
  );
  const [unit, setUnit] = useState(initialValues?.unit ?? "");
  const [price, setPrice] = useState<string>(
    initialValues ? centsToMxDisplay(initialValues.price) : "",
  );
  const parsedPriceCents = parseCurrencyToCents(price);

  // When editing, resolve the InventoryRow from the items list once loaded.
  const initialItemIdRef = useRef(initialValues?.itemId);
  useEffect(() => {
    const id = initialItemIdRef.current;
    if (!id || !items.length || selectedItem) return;
    const found = items.find((i) => i.id === id);
    if (found) setSelectedItem(found);
  }, [items, selectedItem]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const suggestions = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return [];
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [search, items]);

  const unitOptions = useMemo(() => {
    if (!selectedItem?.quantity_type_key) return [];
    return (
      measureTypes[
        selectedItem.quantity_type_key as keyof typeof measureTypes
      ] ?? []
    );
  }, [selectedItem]);

  const exactMatch = useMemo(
    () =>
      items.some(
        (item) => item.name.toLowerCase() === search.toLowerCase().trim(),
      ),
    [search, items],
  );

  const showCreateSection = search.trim().length > 0 && !exactMatch;

  // ── Effects ────────────────────────────────────────────────────────────────

  // Pre-select first unit when item changes — skip when already set by initialValues
  useEffect(() => {
    if (initialItemIdRef.current) return; // unit pre-filled from initialValues
    if (unitOptions.length > 0) setUnit(unitOptions[0]);
    else setUnit("");
  }, [unitOptions]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function reset() {
    setStep("search");
    setSearch("");
    setSelectedItem(null);
    setNewQuantityTypeKey("");
    setQuantity(1);
    setUnit("");
    setPrice("");
  }

  function handleClose() {
    reset();
    onCancel();
  }

  function handleSelectItem(item: InventoryRow) {
    setSelectedItem(item);
    setStep("details");
    // Reset fields for the newly selected item (user changed their mind)
    initialItemIdRef.current = undefined;
    const opts =
      measureTypes[item.quantity_type_key as keyof typeof measureTypes] ?? [];
    setUnit(opts[0] ?? "");
    setQuantity(1);
    setPrice("");
  }

  async function handleCreateAndSelect() {
    const name = search.trim();
    if (!name || !newQuantityTypeKey) return;
    await addItemMutation.mutateAsync({
      name,
      quantityTypeKey: newQuantityTypeKey,
    });
    const result = await refetchItems();
    const created = result.data?.find(
      (item) => item.name.toLowerCase() === name.toLowerCase(),
    );
    if (created) {
      setSelectedItem(created);
      setStep("details");
      initialItemIdRef.current = undefined;
      const opts =
        measureTypes[created.quantity_type_key as keyof typeof measureTypes] ??
        [];
      setUnit(opts[0] ?? "");
      setQuantity(1);
      setPrice("");
    }
  }

  async function handleConfirm() {
    if (!selectedItem || !unit) return;
    await onConfirm({
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      quantityTypeKey: selectedItem.quantity_type_key,
      quantity,
      unit,
      price: parsedPriceCents ?? 0,
    });
    reset();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <DrawerHeader className="pb-0">
        <div className="flex items-center gap-2 text-white font-mono uppercase tracking-widest text-sm">
          {step !== "search" && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 text-white/60 hover:text-white hover:bg-zinc-800"
              onClick={() => setStep("search")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          {title}
          {step === "details" && selectedItem && (
            <span className="text-zinc-400 normal-case font-normal tracking-normal truncate">
              — {selectedItem.name}
            </span>
          )}
        </div>
      </DrawerHeader>

      {/* ── Body ── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        {/* Search Step */}
        {step === "search" && (
          <div className="flex flex-col-reverse gap-3">
            {/* Input — rendered first in DOM for focus, shown at bottom via flex-col-reverse */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500 pointer-events-none" />
              <Input
                autoFocus
                data-testid={TEST_IDS.AGREGAR_GASTO.SEARCH_INPUT}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar o escribir nombre..."
                className="pl-8 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus-visible:ring-zinc-600"
              />
            </div>

            {/* Results + create — appear above input when keyboard is open */}
            {search.trim() && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-0.5">
                  {suggestions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={tid(
                        TEST_IDS.AGREGAR_GASTO.RESULT_ROW,
                        item.id,
                      )}
                      className="flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-zinc-800 active:bg-zinc-700 text-sm text-left transition-colors w-full"
                      onClick={() => handleSelectItem(item)}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full shrink-0 ${
                            item.stock > 0 ? "bg-green-400" : "bg-red-500"
                          }`}
                        />
                        <span className="font-medium text-white">
                          {item.name}
                        </span>
                      </span>
                      <span className="text-xs text-zinc-500 shrink-0 ml-2 bg-zinc-800 rounded px-1.5 py-0.5">
                        {item.quantity_type_key}
                      </span>
                    </button>
                  ))}
                  {suggestions.length === 0 && (
                    <p className="text-sm text-zinc-500 text-center py-4">
                      {`Sin resultados para "${search}"`}
                    </p>
                  )}
                </div>

                {/* Inline create */}
                {showCreateSection && (
                  <div className="border-t border-dashed border-zinc-700 pt-3 flex flex-col gap-2">
                    <p className="text-xs text-zinc-400">
                      Crear nuevo:{" "}
                      <strong className="text-white">{search.trim()}</strong>
                    </p>
                    <Select
                      value={newQuantityTypeKey}
                      onValueChange={setNewQuantityTypeKey}
                    >
                      <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white">
                        <SelectValue placeholder="Tipo de medida" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700 text-white w-[var(--radix-select-trigger-width)]">
                        {Object.entries(measureTypes).map(([key, units]) => (
                          <SelectItem
                            key={key}
                            value={key}
                            textValue={key}
                            className="focus:bg-zinc-700 focus:text-white"
                          >
                            <span className="flex items-baseline gap-1 min-w-0 max-w-full">
                              <span className="shrink-0">{key}</span>
                              <span className="text-zinc-400 truncate text-xs">
                                ({units.join(", ")})
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      data-testid={TEST_IDS.AGREGAR_GASTO.CREATE_BTN}
                      className="w-full bg-white text-black hover:bg-zinc-100"
                      disabled={
                        !newQuantityTypeKey || addItemMutation.isPending
                      }
                      onClick={handleCreateAndSelect}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {addItemMutation.isPending
                        ? "Creando..."
                        : "Crear y seleccionar"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Details Step */}
        {step === "details" && selectedItem && (
          <div className="flex flex-col gap-4">
            {/* Item chip */}
            <div className="rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2.5 flex items-center justify-between">
              <span className="text-sm font-medium text-white">
                {selectedItem.name}
              </span>
              <span className="text-xs text-zinc-400 bg-zinc-800 rounded px-1.5 py-0.5">
                {selectedItem.quantity_type_key}
              </span>
            </div>

            {/* Quantity + Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="item-quantity"
                  className="text-xs text-zinc-400 uppercase tracking-wider"
                >
                  Cantidad
                </Label>
                <Input
                  id="item-quantity"
                  type="number"
                  min={0.001}
                  step={0.01}
                  value={quantity}
                  data-testid={TEST_IDS.AGREGAR_GASTO.QUANTITY_INPUT}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="bg-zinc-900 border-zinc-700 text-white focus-visible:ring-zinc-600"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="item-unit"
                  className="text-xs text-zinc-400 uppercase tracking-wider"
                >
                  Unidad
                </Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger
                    id="item-unit"
                    className="bg-zinc-900 border-zinc-700 text-white"
                  >
                    <SelectValue placeholder="Unidad" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700 text-white">
                    {unitOptions.map((u) => (
                      <SelectItem
                        key={u}
                        value={u}
                        className="focus:bg-zinc-700 focus:text-white"
                      >
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Price */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="item-price"
                className="text-xs text-zinc-400 uppercase tracking-wider"
              >
                Precio <span className="normal-case">(opcional)</span>
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">
                  $
                </span>
                <Input
                  id="item-price"
                  type="text"
                  inputMode="decimal"
                  value={price}
                  data-testid={TEST_IDS.AGREGAR_GASTO.PRICE_INPUT}
                  onChange={(e) => setPrice(e.target.value)}
                  onBlur={() => {
                    const cents = parseCurrencyToCents(price);
                    if (cents !== null) setPrice(centsToMxDisplay(cents));
                  }}
                  placeholder="0.00"
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-zinc-600 pl-7 pr-14"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-500">
                  MXN
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <DrawerFooter className="pt-2 border-t border-zinc-800">
        {step === "details" && (
          <Button
            type="button"
            data-testid={TEST_IDS.AGREGAR_GASTO.CONFIRM_BTN}
            className="w-full bg-white text-black hover:bg-zinc-100 font-semibold"
            disabled={!selectedItem || !unit}
            onClick={handleConfirm}
          >
            Confirmar
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          data-testid={TEST_IDS.AGREGAR_GASTO.CANCEL_BTN}
          className="w-full text-zinc-400 hover:text-white hover:bg-zinc-800"
          onClick={handleClose}
        >
          Cancelar
        </Button>
      </DrawerFooter>
    </>
  );
}

// ── ItemSelector — standalone Drawer wrapper (for use outside Orders) ─────────

export function ItemSelector({
  open,
  onClose,
  onConfirm,
  title,
}: ItemSelectorProps) {
  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent className="bg-black border-zinc-800 text-white max-h-[85dvh] flex flex-col">
        <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-zinc-700" />
        <ItemSelectorContent
          title={title}
          onConfirm={onConfirm}
          onCancel={onClose}
        />
      </DrawerContent>
    </Drawer>
  );
}
