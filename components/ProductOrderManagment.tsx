"use client";

import { useProducts } from "@/context/useProducts";
import { useProductsFilter } from "@/context/useProductsFilter";
import { useAdminStatus } from "@/hooks/useAdminStatus";
import type { PlatformAlert } from "@/lib/sql/types";
import { TEST_IDS } from "@/lib/testIds";
import { useTRPC } from "@/lib/trpc/react";
import { Product } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { SettingsModal } from "./Admin/SettingsPanel";
import EmptyState from "./Products/EmptyState";
import { ProductForm } from "./Products/Form";
import { ListProducts } from "./Products/List";
import { OpenOrderSheet } from "./sheets/Orders";
import { TagsSheet } from "./sheets/Tags";
import TagList from "./Tag/List";

export default function ProductOrderManagment() {
  const { visibleProducts, visibleTags } = useProductsFilter();
  const { isAdmin, role, tenantName, username, session } = useAdminStatus();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<string | undefined>();
  const canOpenSettings = isAdmin || role === "manager";

  const trpc = useTRPC();
  const alertsQuery = useQuery({
    ...trpc.alerts.list.queryOptions({ unreadOnly: true }),
    refetchInterval: 60_000,
    enabled: canOpenSettings,
  });

  // Listen for custom events to open Settings
  useEffect(() => {
    const handleOpenSettings = (event: Event) => {
      const customEvent = event as CustomEvent<{ tab?: string }>;
      if (canOpenSettings) {
        setInitialTab(customEvent.detail?.tab);
        setSettingsOpen(true);
      }
    };
    window.addEventListener("openSettings", handleOpenSettings);
    return () => {
      window.removeEventListener("openSettings", handleOpenSettings);
    };
  }, [canOpenSettings]);

  return (
    <main className="min-h-screen bg-slate-100 flex flex-col justify-between py-3 gap-3">
      {/* Settings FAB — gear button with alert prefix chip */}
      <div className="fixed top-3 right-3 z-50 flex items-center gap-2">
        {canOpenSettings && (
          <AlertFABPrefix
            alerts={alertsQuery.data?.alerts ?? []}
            onOpen={() => {
              setInitialTab("notifications");
              setSettingsOpen(true);
            }}
          />
        )}
        <button
          type="button"
          className="rounded-full bg-white/80 p-2 text-slate-500 shadow hover:bg-white hover:text-slate-800 transition"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          data-testid={TEST_IDS.SETTINGS.FAB}
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
      </div>
      {settingsOpen && (
        <SettingsModal
          onCloseAction={() => {
            setSettingsOpen(false);
            setInitialTab(undefined);
          }}
          initialTab={initialTab}
          tenantName={tenantName ?? "ACME"}
          userName={
            username ??
            (role ? role.charAt(0).toUpperCase() + role.slice(1) : "User")
          }
          sessionData={session as Record<string, unknown> | null}
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

// ── Alert FAB prefix ────────────────────────────────────────────────────────

function SeverityDot({ severity }: { severity: string }) {
  const color =
    severity === "critical"
      ? "bg-red-500"
      : severity === "warning"
        ? "bg-yellow-400"
        : "bg-blue-400";
  return (
    <span className={`size-2 rounded-full shrink-0 mt-0.5 ${color}`} />
  );
}

/**
 * Prefixed chip attached to the Settings FAB.
 * Shows the latest unread alert title + body for 5 s, then fades out.
 * Clicking it opens the Notifications tab.
 */
function AlertFABPrefix({
  alerts,
  onOpen,
}: {
  alerts: PlatformAlert[];
  onOpen: () => void;
}) {
  const [show, setShow] = useState(false);
  const [current, setCurrent] = useState<PlatformAlert | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const latest = alerts[0] ?? null;

  useEffect(() => {
    if (!latest) {
      setShow(false);
      return;
    }
    setCurrent(latest);
    setShow(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShow(false), 5000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
   
  }, [latest?.id]);

  if (!current) return null;

  return (
    <button
      type="button"
      onClick={() => {
        setShow(false);
        if (timerRef.current) clearTimeout(timerRef.current);
        onOpen();
      }}
      aria-label="Ver alerta"
      data-testid={TEST_IDS.SETTINGS.ALERT_PREFIX_CHIP}
      className={[
        "grid grid-cols-[8px_1fr] gap-x-2 items-start",
        "bg-white/90 backdrop-blur-sm shadow rounded-full px-3 py-2",
        "max-w-[200px] text-left cursor-pointer",
        "transition-all duration-300 ease-out",
        show
          ? "opacity-100 translate-x-0"
          : "opacity-0 translate-x-3 pointer-events-none",
      ].join(" ")}
    >
      <SeverityDot severity={current.severity} />
      <div className="min-w-0">
        <p className="text-xs font-semibold leading-tight truncate">
          {current.title}
        </p>
        <p className="text-[10px] text-muted-foreground leading-tight truncate">
          {current.body}
        </p>
      </div>
    </button>
  );
}
