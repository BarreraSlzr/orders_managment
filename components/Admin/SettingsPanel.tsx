"use client";

import { EntitlementBanner } from "@/components/MercadoPago/EntitlementBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { PlatformAlert } from "@/lib/sql/types";
import { TEST_IDS, tid } from "@/lib/testIds";
import { useTRPC } from "@/lib/trpc/react";
import { formatUnixSecondsToReadable, getIsoTimestamp } from "@/utils/stamp";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  BellOff,
  BookOpen,
  Building2,
  CheckCircle,
  CreditCard,
  Download,
  FileText,
  Info,
  LogOut,
  Package,
  RefreshCw,
  Trash2,
  Upload,
  User,
  XCircle
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CSVPreviewTable } from "./CSVPreviewTable";

type Tab = "settings" | "csv" | "export" | "notifications";

// ── Notifications Tab ────────────────────────────────────────────────────────

function AlertSeverityIcon({ severity }: { severity: string }) {
  if (severity === "critical")
    return <AlertTriangle className="size-4 text-red-500 shrink-0" />;
  if (severity === "warning")
    return <AlertCircle className="size-4 text-yellow-500 shrink-0" />;
  return <Info className="size-4 text-blue-500 shrink-0" />;
}

function AlertCard({
  alert,
  onRead,
  onClose,
}: {
  alert: PlatformAlert;
  onRead: (id: string) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const meta =
    alert.metadata != null && typeof alert.metadata === "object"
      ? (alert.metadata as Record<string, unknown>)
      : null;
  const orderId: string | null =
    meta && typeof meta.order_id === "string" ? meta.order_id : null;

  const isRead = alert.read_at != null;

  const handleOrderLink = () => {
    if (orderId) {
      onClose();
      router.push(`/?orderId=${orderId}`);
    }
  };

  return (
    <div
      className={`rounded-lg border p-3 text-sm space-y-1.5 ${
        isRead ? "opacity-60" : "bg-muted/30"
      }`}
      data-testid={tid(TEST_IDS.ALERTS.CARD, alert.id)}
    >
      <div className="flex items-start gap-2">
        <AlertSeverityIcon severity={alert.severity} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium truncate">{alert.title}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {new Intl.RelativeTimeFormat("es", { numeric: "auto" }).format(
                Math.round(
                  (new Date(alert.created_at).getTime() - Date.now()) /
                    1000 /
                    60,
                ),
                "minute",
              )}
            </span>
          </div>
          {alert.body && (
            <p className="text-muted-foreground text-xs mt-0.5">{alert.body}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            {!isRead && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs px-2"
                onClick={() => onRead(alert.id)}
                data-testid={tid(TEST_IDS.ALERTS.MARK_READ_BTN, alert.id)}
              >
                Marcar leído
              </Button>
            )}
            {orderId && (
              <Button
                size="sm"
                variant="link"
                className="h-6 text-xs px-2 text-primary"
                onClick={handleOrderLink}
                data-testid={tid(TEST_IDS.ALERTS.ORDER_LINK_BTN, alert.id)}
              >
                Ver orden →
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationsTab({
  onBackToSettings,
  onClose,
}: {
  onBackToSettings: () => void;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);

  const alertsQuery = useQuery(
    trpc.alerts.list.queryOptions({ unreadOnly }),
  );

  const markReadMutation = useMutation(
    trpc.alerts.markRead.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: trpc.alerts.list.queryKey() }),
    }),
  );

  const markAllMutation = useMutation(
    trpc.alerts.markAllRead.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: trpc.alerts.list.queryKey() }),
    }),
  );

  const alerts = alertsQuery.data?.alerts ?? [];
  const unreadCount = alertsQuery.data?.unreadCount ?? 0;

  return (
    <div className="space-y-4" data-testid={TEST_IDS.SETTINGS.NOTIFICATIONS_TAB}>
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={onBackToSettings}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex items-center gap-1.5">
          <Bell className="size-4" />
          <h3 className="font-semibold text-sm">Notificaciones</h3>
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="text-[10px] px-1.5 py-0"
              data-testid={TEST_IDS.SETTINGS.UNREAD_BADGE}
            >
              {unreadCount}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button
          size="sm"
          variant={unreadOnly ? "secondary" : "outline"}
          className="h-7 text-xs"
          onClick={() => setUnreadOnly((v) => !v)}
          data-testid={TEST_IDS.SETTINGS.UNREAD_FILTER_BTN}
        >
          {unreadOnly ? (
            <>
              <Bell className="size-3 mr-1" /> Solo no leídas
            </>
          ) : (
            <>
              <BellOff className="size-3 mr-1" /> Todas
            </>
          )}
        </Button>
        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            disabled={markAllMutation.isPending}
            onClick={() => markAllMutation.mutate({})}
            data-testid={TEST_IDS.SETTINGS.MARK_ALL_READ_BTN}
          >
            <CheckCircle className="size-3 mr-1" />
            Marcar todas como leídas
          </Button>
        )}
      </div>

      {alertsQuery.isLoading && (
        <div className="text-xs text-muted-foreground text-center py-6">
          Cargando...
        </div>
      )}

      {!alertsQuery.isLoading && alerts.length === 0 && (
        <div className="text-xs text-muted-foreground text-center py-8 space-y-2">
          <BellOff className="size-6 mx-auto opacity-40" />
          <p>Sin notificaciones</p>
        </div>
      )}

      <div className="space-y-2">
        {alerts.map((alert) => (
          <AlertCard
            key={alert.id}
            alert={alert}
            onRead={(id) => markReadMutation.mutate({ id })}
            onClose={onClose}
          />
        ))}
      </div>
    </div>
  );
}

// ── Tab routing ───────────────────────────────────────────────────────────────

function normalizeInitialTab(initialTab?: string): Tab {
  if (initialTab === "csv") return "csv";
  if (initialTab === "export") return "export";
  if (initialTab === "notifications") return "notifications";
  return "settings";
}

export function SettingsModal({
  onCloseAction,
  initialTab,
  tenantName = "Acme Corporation",
  userName = "John Doe",
  sessionData = null,
}: {
  onCloseAction: () => void;
  initialTab?: string;
  tenantName?: string;
  userName?: string;
  sessionData?: Record<string, unknown> | null;
}) {
  const [activeTab, setActiveTab] = useState<Tab>(
    normalizeInitialTab(initialTab),
  );

  const tabTitles: Record<Tab, string> = {
    settings: "Settings",
    csv: "Import",
    export: "Export",
    notifications: "Notificaciones",
  };

  const sessionHeaderItems = [
    { key: "role", label: "Role" },
    { key: "tenant_id", label: "Tenant" },
    {
      key: "exp",
      label: "Expires",
      format: (value: unknown) =>
        formatUnixSecondsToReadable(value as number | string) ?? String(value),
    },
  ]
    .map((item) => {
      const value = sessionData?.[item.key];
      if (value === undefined || value === null || value === "") return null;
      return {
        label: item.label,
        value: item.format ? item.format(value) : String(value),
      };
    })
    .filter((item): item is { label: string; value: string } => item !== null);

  useEffect(() => {
    setActiveTab(normalizeInitialTab(initialTab));
  }, [initialTab]);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCloseAction();
      }}
    >
        <DialogContent
          className="max-w-3xl max-h-[90vh] overflow-y-auto"
          data-testid={TEST_IDS.SETTINGS.MODAL}
        >
        <DialogHeader className="space-y-2 pb-2 border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="rounded-md bg-muted p-2 shrink-0">
                <Building2 className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="truncate">{tenantName}</DialogTitle>
                <DialogDescription className="flex items-center gap-1.5 mt-1 text-xs">
                  <User className="size-3.5" />
                  <span className="truncate">{userName}</span>
                </DialogDescription>
              </div>
            </div>
            <span className="text-xs rounded-full border px-2 py-1 mr-7 text-muted-foreground shrink-0">
              {tabTitles[activeTab].toLocaleUpperCase()}
            </span>
          </div>
          {sessionHeaderItems.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {sessionHeaderItems.map((item) => (
                <span
                  key={item.label}
                  className="text-[10px] rounded border px-1.5 py-0.5 text-muted-foreground"
                >
                  {item.label}: {item.value}
                </span>
              ))}
            </div>
          )}
        </DialogHeader>

        <div className="pt-4">
          {activeTab === "settings" && (
            <SettingsHomeTab onOpenTab={(tab) => setActiveTab(tab)} />
          )}
          {activeTab === "csv" && (
            <CSVImportTab onBackToSettings={() => setActiveTab("settings")} />
          )}
          {activeTab === "export" && (
            <ExportTab onBackToSettings={() => setActiveTab("settings")} />
          )}
          {activeTab === "notifications" && (
            <NotificationsTab
              onBackToSettings={() => setActiveTab("settings")}
              onClose={onCloseAction}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SettingsHomeTab({
  onOpenTab,
}: {
  onOpenTab: (tab: "csv" | "export" | "notifications") => void;
}) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout failed:", error);
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Alertas</h3>
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-between"
          onClick={() => onOpenTab("notifications")}
        >
          <span className="flex items-center gap-2">
            <Bell className="size-4" />
            Notificaciones
          </span>
          <ArrowRight className="size-4" />
        </Button>
      </section>
      <Separator />
      <section className="space-y-2">

        <Button
          size="sm"
          variant="destructive"
          className="w-full justify-start"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          <LogOut className="h-3.5 w-3.5 mr-1" />
          {isLoggingOut ? "Logging out..." : "Logout"}
        </Button>

        <div className="grid gap-2">
          <Button
            asChild
            size="sm"
            variant="outline"
            className="justify-between"
          >
            <Link href="/onboardings">
              <span className="flex items-center gap-2">
                <BookOpen className="size-4" />
                Onboarding
              </span>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="justify-between"
          >
            <Link href="/items">
              <span className="flex items-center gap-2">
                <Package className="size-4" />
                Inventory
              </span>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <CreditCard className="size-4" />
          <h3 className="text-sm font-semibold">Mercado Pago</h3>
        </div>
        <MercadoPagoTab />
      </section>

      <Separator />

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Data</h3>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" onClick={() => onOpenTab("csv")}>
            <Upload className="h-3.5 w-3.5 mr-1" />
            Import
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenTab("export")}
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Export
          </Button>
        </div>
      </section>
    </div>
  );
}

// ── CSV Import Tab ────────────────────────────────────────────────────────

function CSVImportTab({ onBackToSettings }: { onBackToSettings: () => void }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    errors: Array<{ line: number; raw: string; message: string }>;
    totalLines: number;
  } | null>(null);

  const uploadMutation = useMutation(trpc.products.csvUpload.mutationOptions());
  const resetAndImportMutation = useMutation(
    trpc.products.resetAndImport.mutationOptions(),
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      setResult(null);

      if (!file) {
        setFileName(null);
        setCsvContent(null);
        return;
      }

      if (!file.name.endsWith(".csv")) {
        setFileName(null);
        setCsvContent(null);
        return;
      }

      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (ev) => setCsvContent(ev.target?.result as string);
      reader.readAsText(file, "utf-8");
    },
    [],
  );

  const handleUpload = useCallback(async () => {
    if (!csvContent) return;
    try {
      const res = await uploadMutation.mutateAsync({ csv: csvContent });
      setResult(res);
      if (res.imported > 0) {
        await queryClient.invalidateQueries({
          queryKey: [["products", "list"]],
        });
      }
    } catch (err) {
      setResult({
        imported: 0,
        skipped: 0,
        totalLines: 0,
        errors: [
          {
            line: 0,
            raw: "",
            message: err instanceof Error ? err.message : "Upload failed",
          },
        ],
      });
    }
  }, [csvContent, uploadMutation, queryClient]);

  const handleResetAndImport = useCallback(async () => {
    if (!csvContent) return;
    try {
      const res = await resetAndImportMutation.mutateAsync({ csv: csvContent });
      setResult(res);
      if (res.imported > 0) {
        await queryClient.invalidateQueries({
          queryKey: [["products", "list"]],
        });
      }
    } catch (err) {
      setResult({
        imported: 0,
        skipped: 0,
        totalLines: 0,
        errors: [
          {
            line: 0,
            raw: "",
            message: err instanceof Error ? err.message : "Reset failed",
          },
        ],
      });
    }
  }, [csvContent, resetAndImportMutation, queryClient]);

  const handleReset = useCallback(() => {
    setFileName(null);
    setCsvContent(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const isPending =
    uploadMutation.isPending || resetAndImportMutation.isPending;

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        onClick={onBackToSettings}
      >
        <ArrowLeft className="h-3.5 w-3.5 mr-1" />
        Back to Settings
      </Button>

      {/* Format hint */}
      <div className="text-xs text-muted-foreground bg-muted rounded p-2 font-mono">
        <p className="font-semibold mb-1">CSV Format:</p>
        <p>name,price,tags</p>
        <p>&quot;Ensalada Panela&quot;,10500,&quot;ensalada,panela&quot;</p>
      </div>

      {/* File input */}
      <div className="space-y-2">
        <Label htmlFor="csv-file-settings">CSV File</Label>
        <Input
          ref={fileInputRef}
          id="csv-file-settings"
          type="file"
          accept=".csv"
          onChange={handleFileChange}
        />
      </div>

      {fileName && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          {fileName}
        </div>
      )}

      {/* CSV Preview */}
      {csvContent && (
        <div>
          <p className="text-sm font-medium mb-2">Preview</p>
          <CSVPreviewTable csv={csvContent} />
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={handleUpload}
          disabled={!csvContent || isPending}
          size="sm"
        >
          <Upload className="h-3.5 w-3.5 mr-1" />
          {uploadMutation.isPending ? "Importing…" : "Import (Merge)"}
        </Button>
        <Button
          onClick={handleResetAndImport}
          disabled={!csvContent || isPending}
          variant="destructive"
          size="sm"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          {resetAndImportMutation.isPending ? "Resetting…" : "Reset & Import"}
        </Button>
        <Button variant="outline" size="sm" onClick={handleReset}>
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Clear
        </Button>
      </div>

      {/* Upload results */}
      {result && <UploadResultDisplay result={result} />}
    </div>
  );
}

function UploadResultDisplay({
  result,
}: {
  result: {
    imported: number;
    skipped: number;
    errors: Array<{ line: number; raw: string; message: string }>;
  };
}) {
  return (
    <div className="space-y-2 text-sm">
      {result.imported > 0 && (
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle className="h-4 w-4" />
          {result.imported} product(s) imported
        </div>
      )}
      {result.skipped > 0 && (
        <div className="text-yellow-600">{result.skipped} row(s) skipped</div>
      )}
      {result.errors.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-red-600 font-medium">
            <AlertCircle className="h-4 w-4" />
            {result.errors.length} error(s)
          </div>
          <ul className="text-xs text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
            {result.errors.map((err, idx) => (
              <li key={idx} className="font-mono bg-muted rounded px-2 py-1">
                {err.line > 0 && <span>Line {err.line}: </span>}
                {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Export Tab ────────────────────────────────────────────────────────────

function ExportTab({ onBackToSettings }: { onBackToSettings: () => void }) {
  const trpc = useTRPC();
  const exportQuery = useQuery(trpc.products.export.queryOptions());
  const exportDate = getIsoTimestamp().slice(0, 10);

  const handleDownloadJSON = useCallback(() => {
    if (!exportQuery.data) return;
    const blob = new Blob([exportQuery.data.json], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products-${exportDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportDate, exportQuery.data]);

  const handleDownloadCSV = useCallback(() => {
    if (!exportQuery.data) return;
    const products = JSON.parse(exportQuery.data.json) as Array<{
      name: string;
      price: number;
      tags: string;
    }>;
    const header = "name,price,tags";
    const rows = products.map(
      (p) =>
        `"${p.name.replace(/"/g, '""')}",${p.price},"${p.tags.replace(
          /"/g,
          '""',
        )}"`,
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products-${exportDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportDate, exportQuery.data]);

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        onClick={onBackToSettings}
      >
        <ArrowLeft className="h-3.5 w-3.5 mr-1" />
        Back to Settings
      </Button>

      <p className="text-sm text-muted-foreground">
        Export current products for backup or transfer to another environment.
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleDownloadJSON}
          disabled={exportQuery.isLoading || !exportQuery.data}
        >
          <Download className="h-3.5 w-3.5 mr-1" />
          Download JSON
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleDownloadCSV}
          disabled={exportQuery.isLoading || !exportQuery.data}
        >
          <Download className="h-3.5 w-3.5 mr-1" />
          Download CSV
        </Button>
      </div>
      {exportQuery.data && (
        <p className="text-xs text-muted-foreground">
          {JSON.parse(exportQuery.data.json).length} product(s) available for
          export
        </p>
      )}
    </div>
  );
}

// ── Mercado Pago Onboarding Tab ───────────────────────────────────────────────

function MercadoPagoTab() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [contactEmail, setContactEmail] = useState("");
  const [disconnectedMode, setDisconnectedMode] = useState(false);

  const credentialsQuery = useQuery(
    trpc.mercadopago.credentials.get.queryOptions(),
  );

  const oauthCheckQuery = useQuery(
    trpc.mercadopago.credentials.checkOAuth.queryOptions(),
  );

  const creds = credentialsQuery.data;
  const oauthAvailable = oauthCheckQuery.data?.available ?? false;
  const normalizedContactEmail = contactEmail.trim().toLowerCase();
  const isContactEmailValid = /^\S+@\S+\.\S+$/.test(normalizedContactEmail);
  const isConnected = creds?.status === "active" && !disconnectedMode;

  // Pre-fill email from existing credentials
  useEffect(() => {
    if (creds?.contactEmail && !contactEmail) {
      setContactEmail(creds.contactEmail);
    }
  }, [contactEmail, creds?.contactEmail]);

  useEffect(() => {
    if (creds?.status === "active") {
      setDisconnectedMode(false);
    }
  }, [creds?.status]);

  // Handle OAuth callback notifications
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthStatus = params.get("mp_oauth");
    const message = params.get("message");

    if (oauthStatus === "success") {
      toast.success("Mercado Pago conectado", {
        description: "Credenciales guardadas exitosamente.",
        duration: 4000,
      });
      window.history.replaceState({}, "", window.location.pathname);
      void queryClient.invalidateQueries({
        queryKey: trpc.mercadopago.credentials.get.queryOptions().queryKey,
      });
    } else if (oauthStatus === "error") {
      toast.error("Error al conectar Mercado Pago", {
        description: message ?? "Intenta nuevamente.",
        duration: 6000,
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [queryClient, trpc]);

  const handleOAuthConnect = () => {
    if (!isContactEmailValid) {
      toast.error("Correo inválido", {
        description: "Ingresa un correo válido para conectar Mercado Pago.",
        duration: 4000,
      });
      return;
    }

    const oauthUrl = new URL(
      "/api/mercadopago/oauth/authorize",
      window.location.origin,
    );
    oauthUrl.searchParams.set("email", normalizedContactEmail);
    window.location.href = oauthUrl.toString();
  };

  const handleDisconnect = () => {
    setDisconnectedMode(true);
  };

  return (
    <div className="space-y-4">
      <EntitlementBanner
        subscriptionStatus={creds?.subscriptionStatus}
        gracePeriodEnd={creds?.gracePeriodEnd}
      />
      {creds?.status === "error" && !disconnectedMode && (
        <div className="flex items-center gap-2 rounded-md px-3 py-2 text-sm bg-red-50 text-red-700 border border-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{creds.errorMessage ?? "Error de conexión"}</span>
        </div>
      )}

      <div className="rounded-md border bg-muted/50 p-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="mp-contact-email">Email Address</Label>
          <Input
            id="mp-contact-email"
            type="email"
            placeholder="your@email.com"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
            disabled={isConnected}
            className="bg-background"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                <CheckCircle className="size-4 text-green-500" />
                <span className="text-sm text-green-600 font-medium">
                  Connected
                </span>
              </>
            ) : (
              <>
                <XCircle className="size-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Not connected
                </span>
              </>
            )}
          </div>

          {isConnected ? (
            <Button variant="outline" size="sm" onClick={handleDisconnect}>
              Disconnect
            </Button>
          ) : oauthAvailable ? (
            <Button
              size="sm"
              onClick={handleOAuthConnect}
              disabled={!isContactEmailValid}
            >
              Connect
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled>
              Connect
            </Button>
          )}
        </div>
      </div>

      {!oauthAvailable && !credentialsQuery.isLoading && (
        <div className="flex items-center gap-2 rounded-md px-3 py-2 text-sm bg-slate-50 text-slate-600 border">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Mercado Pago OAuth no está configurado.</span>
        </div>
      )}

      {isConnected && creds?.userId && (
        <p className="text-xs text-muted-foreground">
          Connected as account {creds.userId}.
        </p>
      )}

      {disconnectedMode && (
        <p className="text-xs text-muted-foreground">
          Disconnected locally. Connect again to replace tenant credentials.
        </p>
      )}
    </div>
  );
}
