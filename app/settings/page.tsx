"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAdminStatus } from "@/hooks/useAdminStatus";
import type { PlatformAlert } from "@/lib/sql/types";
import { useTRPC } from "@/lib/trpc/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bell, BellOff, BookOpen, Info, RefreshCw, Zap } from "lucide-react";
import { useState } from "react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  claim: "Reclamo",
  subscription: "Suscripción",
  changelog: "Novedad",
  system: "Sistema",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  claim: <AlertTriangle className="h-4 w-4" />,
  subscription: <RefreshCw className="h-4 w-4" />,
  changelog: <BookOpen className="h-4 w-4" />,
  system: <Zap className="h-4 w-4" />,
};

const SEVERITY_CLASSES: Record<string, string> = {
  critical: "border-red-200 bg-red-50",
  warning: "border-amber-200 bg-amber-50",
  info: "border-slate-200 bg-white",
};

const SEVERITY_ICON_CLASSES: Record<string, string> = {
  critical: "text-red-500",
  warning: "text-amber-500",
  info: "text-slate-400",
};

const SEVERITY_BADGE_VARIANTS: Record<
  string,
  "destructive" | "default" | "secondary" | "outline"
> = {
  critical: "destructive",
  warning: "default",
  info: "secondary",
};

function formatRelativeDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  return `hace ${diffD} d`;
}

// ─── Alert card ───────────────────────────────────────────────────────────────

function AlertCard(props: {
  alert: PlatformAlert;
  onMarkRead: (id: string) => void;
  isMarkingRead: boolean;
}) {
  const { alert, onMarkRead, isMarkingRead } = props;
  const isUnread = !alert.read_at;

  return (
    <div
      className={`relative flex gap-3 rounded-xl border p-4 transition-colors ${
        SEVERITY_CLASSES[alert.severity] ?? "border-slate-200 bg-white"
      } ${isUnread ? "ring-1 ring-inset ring-slate-300/40" : "opacity-70"}`}
    >
      {/* Unread dot */}
      {isUnread && (
        <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-blue-500" />
      )}

      {/* Icon */}
      <span
        className={`mt-0.5 shrink-0 ${
          SEVERITY_ICON_CLASSES[alert.severity] ?? "text-slate-400"
        }`}
      >
        {TYPE_ICONS[alert.type] ?? <Info className="h-4 w-4" />}
      </span>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-1 pr-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">
            {alert.title}
          </span>
          <Badge
            variant={SEVERITY_BADGE_VARIANTS[alert.severity] ?? "secondary"}
            className="text-[10px]"
          >
            {TYPE_LABELS[alert.type] ?? alert.type}
          </Badge>
        </div>

        {alert.body && (
          <p className="text-sm text-slate-600">{alert.body}</p>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs text-slate-400">
            {formatRelativeDate(alert.created_at)}
            {alert.source_id && (
              <> · ID: {alert.source_id}</>
            )}
          </span>

          {isUnread && (
            <button
              onClick={() => onMarkRead(alert.id)}
              disabled={isMarkingRead}
              className="text-xs text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline disabled:opacity-40"
            >
              Marcar leído
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Notifications tab ────────────────────────────────────────────────────────

function NotificationsTab(props: { isAdmin: boolean }) {
  const { isAdmin } = props;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);

  // Tenant alerts (requires session with tenant_id)
  const tenantAlertsQuery = useQuery({
    ...trpc.alerts.list.queryOptions({ unreadOnly }),
    enabled: !isAdmin,
  });

  // Admin alerts
  const adminAlertsQuery = useQuery({
    ...trpc.alerts.adminList.queryOptions({ unreadOnly }),
    enabled: isAdmin,
  });

  const activeQuery = isAdmin ? adminAlertsQuery : tenantAlertsQuery;
  const alerts: PlatformAlert[] = (activeQuery.data?.alerts ?? []) as PlatformAlert[];
  const unreadCount = activeQuery.data?.unreadCount ?? 0;

  // Mark single read
  const markReadMutation = useMutation({
    ...(isAdmin
      ? trpc.alerts.adminMarkRead.mutationOptions()
      : trpc.alerts.markRead.mutationOptions()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.alerts.list.queryKey() });
      queryClient.invalidateQueries({ queryKey: trpc.alerts.adminList.queryKey() });
    },
  });

  // Mark all read
  const markAllReadMutation = useMutation({
    ...(isAdmin
      ? trpc.alerts.adminMarkAllRead.mutationOptions()
      : trpc.alerts.markAllRead.mutationOptions()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.alerts.list.queryKey() });
      queryClient.invalidateQueries({ queryKey: trpc.alerts.adminList.queryKey() });
    },
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">
            Notificaciones
          </span>
          {unreadCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setUnreadOnly((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              unreadOnly
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-200 text-slate-600 hover:border-slate-400"
            }`}
          >
            {unreadOnly ? (
              <BellOff className="h-3 w-3" />
            ) : (
              <Bell className="h-3 w-3" />
            )}
            {unreadOnly ? "Solo no leídas" : "Todas"}
          </button>

          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllReadMutation.mutate({})}
              disabled={markAllReadMutation.isPending}
              className="h-7 rounded-full text-xs"
            >
              Marcar todo como leído
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      {activeQuery.isLoading && (
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-6 text-center text-sm text-slate-400">
          Cargando notificaciones…
        </div>
      )}

      {activeQuery.isError && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
          Error al cargar notificaciones. Intenta de nuevo.
        </div>
      )}

      {!activeQuery.isLoading && alerts.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-10 text-center">
          <Bell className="h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">
            {unreadOnly ? "Sin notificaciones no leídas" : "Sin notificaciones"}
          </p>
          <p className="text-xs text-slate-400">
            Los reclamos, cambios de suscripción y anuncios aparecerán aquí.
          </p>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onMarkRead={(id) => markReadMutation.mutate({ id })}
              isMarkingRead={markReadMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "notifications";

const TABS: { id: Tab; label: string }[] = [
  { id: "notifications", label: "Notificaciones" },
];

export default function SettingsPage() {
  const { isAdmin, isLoading } = useAdminStatus();
  const [activeTab, setActiveTab] = useState<Tab>("notifications");

  if (isLoading) {
    return (
      <div className="rounded-2xl border bg-white/80 p-6 text-sm text-slate-500">
        Cargando…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Configuración
        </p>
        <h1 className="font-[var(--font-onboarding)] text-3xl text-slate-900">
          Settings
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 pb-3 pt-1 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-2xl border bg-white/90 p-6 shadow-sm">
        {activeTab === "notifications" && (
          <NotificationsTab isAdmin={isAdmin ?? false} />
        )}
      </div>
    </div>
  );
}
