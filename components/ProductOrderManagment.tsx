"use client";

import { useProducts } from "@/context/useProducts";
import { useProductsFilter } from "@/context/useProductsFilter";
import { useAdminStatus } from "@/hooks/useAdminStatus";
import { Product } from "@/lib/types";
import { useEffect, useState } from "react";
import { AdminSettingsPanel } from "./Admin/AdminSettingsPanel";
import EmptyState from "./Products/EmptyState";
import { ProductForm } from "./Products/Form";
import { ListProducts } from "./Products/List";
import { OpenOrderSheet } from "./sheets/Orders";
import { TagsSheet } from "./sheets/Tags";
import TagList from "./Tag/List";

export default function ProductOrderManagment() {
  const { visibleProducts, visibleTags } = useProductsFilter();
  const { isAdmin, role } = useAdminStatus();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<string | undefined>();
  const canOpenSettings = isAdmin || role === "manager";

  // Listen for custom events to open Admin Settings
  useEffect(() => {
    const handleOpenSettings = (event: Event) => {
      const customEvent = event as CustomEvent<{ tab?: string }>;
      if (canOpenSettings) {
        setInitialTab(customEvent.detail?.tab);
        setSettingsOpen(true);
      }
    };
    window.addEventListener("openAdminSettings", handleOpenSettings);
    return () => {
      window.removeEventListener("openAdminSettings", handleOpenSettings);
    };
  }, [canOpenSettings]);

  return (
    <main className="min-h-screen bg-slate-100 flex flex-col justify-between py-3 gap-3">
      <button
        type="button"
        className="fixed top-3 right-3 z-50 rounded-full bg-white/80 p-2 text-slate-500 shadow hover:bg-white hover:text-slate-800 transition"
        onClick={() => setSettingsOpen(true)}
        aria-label="Admin settings"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
      {settingsOpen && (
        <AdminSettingsPanel
          onClose={() => {
            setSettingsOpen(false);
            setInitialTab(undefined);
          }}
          initialTab={initialTab}
        />
      )}
      <div className="sticky top-0 z-10 bg-slate-100/76 p-3 backdrop-blur-sm">
        <TagList tags={visibleTags} />
      </div>
      <div className="p-3">
        {visibleProducts.length === 0 && <EmptyState />}
        <ListProducts products={visibleProducts} />
        <Actions />
      </div>
    </main>
  );
}

const Actions = () => {
  const { currentProduct, handleEditProduct } = useProducts();

  // Disable scroll on body when modal is open
  useEffect(() => {
    if (currentProduct) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [currentProduct]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if clicking the backdrop itself, not the form card
    if (e.target === e.currentTarget) {
      handleEditProduct(undefined);
    }
  };

  const handleEscapeKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      handleEditProduct(undefined);
    }
  };

  if (currentProduct)
    return (
      <div
        className="fixed inset-0 z-[70] backdrop-blur-sm bg-slate-400/30 p-4 flex flex-col items-center gap-3 overflow-auto"
        onClick={handleBackdropClick}
        onKeyDown={handleEscapeKey}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        <ProductForm product={currentProduct as Product} />
      </div>
    );
  return (
    <div className="sticky bottom-4 flex justify-between items-end">
      <TagsSheet />
      <OpenOrderSheet />
    </div>
  );
};
