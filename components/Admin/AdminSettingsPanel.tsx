"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminStatus } from "@/hooks/useAdminStatus";
import { useTRPC } from "@/lib/trpc/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Building2,
  CheckCircle,
  Download,
  FileText,
  RefreshCw,
  Settings,
  Trash2,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { CSVPreviewTable } from "./CSVPreviewTable";

type Tab = "csv" | "export" | "status" | "onboard-manager" | "onboard-staff";

export function AdminSettingsPanel({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>("csv");
  const { isAdmin, role } = useAdminStatus();
  const canOnboardManager = isAdmin;
  const canOnboardStaff = role === "manager";

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "csv", label: "CSV Import" },
    { key: "export", label: "Export" },
    { key: "status", label: "DB Status" },
    ...(canOnboardManager
      ? [{ key: "onboard-manager" as Tab, label: "Onboard Manager" }]
      : []),
    ...(canOnboardStaff
      ? [{ key: "onboard-staff" as Tab, label: "Onboard Staff" }]
      : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="flex-shrink-0 flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Admin Settings
          </CardTitle>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </CardHeader>
        <div className="flex gap-1 px-6 border-b">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <CardContent className="flex-1 overflow-y-auto pt-4">
          {activeTab === "csv" && <CSVImportTab />}
          {activeTab === "export" && <ExportTab />}
          {activeTab === "status" && <DBStatusTab />}
          {activeTab === "onboard-manager" && canOnboardManager && (
            <OnboardManagerTab />
          )}
          {activeTab === "onboard-staff" && canOnboardStaff && (
            <OnboardStaffTab />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── CSV Import Tab ────────────────────────────────────────────────────────

function CSVImportTab() {
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

function ExportTab() {
  const trpc = useTRPC();
  const exportQuery = useQuery(trpc.products.export.queryOptions());

  const handleDownloadJSON = useCallback(() => {
    if (!exportQuery.data) return;
    const blob = new Blob([exportQuery.data.json], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportQuery.data]);

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
    a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportQuery.data]);

  return (
    <div className="space-y-4">
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

// ── DB Status Tab ────────────────────────────────────────────────────────

function DBStatusTab() {
  const trpc = useTRPC();
  const statusQuery = useQuery(trpc.admin.migrationStatus.queryOptions());
  const countsQuery = useQuery(trpc.admin.tableCounts.queryOptions());

  return (
    <div className="space-y-4">
      {/* Migration status */}
      <div>
        <p className="text-sm font-medium mb-2">Migration Status</p>
        {statusQuery.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : statusQuery.error ? (
          <p className="text-xs text-red-600">
            Error: {statusQuery.error.message}
          </p>
        ) : statusQuery.data ? (
          <div className="text-xs space-y-1 bg-muted rounded p-2">
            <div>
              Current version:{" "}
              <span className="font-mono font-semibold">
                {statusQuery.data.current ?? "none"}
              </span>
            </div>
            <div>Applied: {statusQuery.data.applied.join(", ") || "none"}</div>
            <div>
              Pending:{" "}
              <span
                className={
                  statusQuery.data.pending.length > 0
                    ? "text-yellow-600 font-semibold"
                    : ""
                }
              >
                {statusQuery.data.pending.join(", ") || "none"}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Table counts */}
      <div>
        <p className="text-sm font-medium mb-2">Table Row Counts</p>
        {countsQuery.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : countsQuery.error ? (
          <p className="text-xs text-red-600">
            Error: {countsQuery.error.message}
          </p>
        ) : countsQuery.data ? (
          <div className="grid grid-cols-2 gap-1 text-xs">
            {Object.entries(countsQuery.data).map(([table, count]) => (
              <div
                key={table}
                className="flex justify-between bg-muted rounded px-2 py-1"
              >
                <span className="font-mono">{table}</span>
                <span className="font-semibold tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Onboarding Tabs ──────────────────────────────────────────────────────

function OnboardManagerTab() {
  const trpc = useTRPC();
  const [tenantName, setTenantName] = useState("");
  const [managerUsername, setManagerUsername] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [result, setResult] = useState<{
    tenantName: string;
    username: string;
    tempPassword: string;
  } | null>(null);

  const onboardMutation = useMutation(
    trpc.admin.onboardManager.mutationOptions(),
  );

  const handleSubmit = useCallback(async () => {
    setResult(null);
    const res = await onboardMutation.mutateAsync({
      tenantName,
      managerUsername,
      tempPassword: tempPassword || undefined,
    });
    setResult({
      tenantName: res.tenantName,
      username: res.username,
      tempPassword: res.tempPassword,
    });
  }, [tenantName, managerUsername, tempPassword, onboardMutation]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Create a new tenant and its manager. A temporary password will be
        generated if you leave it blank.
      </div>

      <div className="space-y-2">
        <Label htmlFor="tenant-name">Tenant Name</Label>
        <Input
          id="tenant-name"
          value={tenantName}
          onChange={(e) => setTenantName(e.target.value)}
          placeholder="New tenant name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="manager-username">Manager Username</Label>
        <Input
          id="manager-username"
          value={managerUsername}
          onChange={(e) => setManagerUsername(e.target.value)}
          placeholder="manager username"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="manager-password">Temp Password (optional)</Label>
        <Input
          id="manager-password"
          value={tempPassword}
          onChange={(e) => setTempPassword(e.target.value)}
          placeholder="auto-generated if empty"
        />
      </div>

      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={
          !tenantName.trim() ||
          !managerUsername.trim() ||
          onboardMutation.isPending
        }
      >
        <Building2 className="h-3.5 w-3.5 mr-1" />
        {onboardMutation.isPending ? "Creating…" : "Create Tenant & Manager"}
      </Button>

      {onboardMutation.error && (
        <p className="text-xs text-red-600">{onboardMutation.error.message}</p>
      )}

      {result && (
        <div className="text-sm space-y-1 bg-muted rounded p-3">
          <div>
            Tenant: <span className="font-semibold">{result.tenantName}</span>
          </div>
          <div>
            Username: <span className="font-semibold">{result.username}</span>
          </div>
          <div>
            Temp Password:{" "}
            <span className="font-mono">{result.tempPassword}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function OnboardStaffTab() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [permissions, setPermissions] = useState<string[]>([
    "orders.create",
    "orders.update",
    "orders.delete",
    "orders.close",
  ]);
  const [result, setResult] = useState<{
    username: string;
    tempPassword: string;
  } | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [savedStaff, setSavedStaff] = useState<Record<string, boolean>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const onboardMutation = useMutation(
    trpc.users.onboardStaff.mutationOptions(),
  );
  const listStaffQuery = useQuery(trpc.users.listStaff.queryOptions());
  const updatePermissionsMutation = useMutation(
    trpc.users.updatePermissions.mutationOptions(),
  );

  const handleSubmit = useCallback(async () => {
    setResult(null);
    const res = await onboardMutation.mutateAsync({
      username,
      tempPassword: tempPassword || undefined,
      permissions,
    });
    setResult({ username: res.username, tempPassword: res.tempPassword });
    setUsername("");
    setTempPassword("");
    await queryClient.invalidateQueries({ queryKey: [["users", "listStaff"]] });
  }, [username, tempPassword, permissions, onboardMutation, queryClient]);

  const permissionOptions = [
    { key: "orders.create", label: "Create orders" },
    { key: "orders.update", label: "Update orders" },
    { key: "orders.delete", label: "Delete orders" },
    { key: "orders.close", label: "Close orders" },
  ];

  const togglePermission = useCallback((key: string) => {
    setPermissions((current) =>
      current.includes(key)
        ? current.filter((p) => p !== key)
        : [...current, key],
    );
  }, []);

  const handleStaffToggle = useCallback(
    async (userId: string, key: string, current: string[]) => {
      const next = current.includes(key)
        ? current.filter((p) => p !== key)
        : [...current, key];

      setSavingUserId(userId);
      setSaveError(null);

      try {
        await updatePermissionsMutation.mutateAsync({
          userId,
          permissions: next,
        });

        await queryClient.invalidateQueries({
          queryKey: [["users", "listStaff"]],
        });

        setSavedStaff((prev) => ({ ...prev, [userId]: true }));
        setTimeout(() => {
          setSavedStaff((prev) => {
            const nextState = { ...prev };
            delete nextState[userId];
            return nextState;
          });
        }, 2000);
      } catch (err) {
        setSaveError(
          err instanceof Error ? err.message : "Failed to save permissions",
        );
      } finally {
        setSavingUserId(null);
      }
    },
    [updatePermissionsMutation, queryClient],
  );

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Create a staff account for your tenant. Leave password blank to
        auto-generate.
      </div>

      <div className="space-y-2">
        <Label htmlFor="staff-username">Staff Username</Label>
        <Input
          id="staff-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="staff username"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="staff-password">Temp Password (optional)</Label>
        <Input
          id="staff-password"
          value={tempPassword}
          onChange={(e) => setTempPassword(e.target.value)}
          placeholder="auto-generated if empty"
        />
      </div>

      <div className="space-y-2">
        <Label>Permissions</Label>
        <div className="space-y-2">
          {permissionOptions.map((permission) => (
            <label
              key={permission.key}
              className="flex items-center gap-2 text-sm"
            >
              <Checkbox
                checked={permissions.includes(permission.key)}
                onCheckedChange={() => togglePermission(permission.key)}
              />
              {permission.label}
            </label>
          ))}
        </div>
      </div>

      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={!username.trim() || onboardMutation.isPending}
      >
        <UserPlus className="h-3.5 w-3.5 mr-1" />
        {onboardMutation.isPending ? "Creating…" : "Create Staff"}
      </Button>

      {onboardMutation.error && (
        <p className="text-xs text-red-600">{onboardMutation.error.message}</p>
      )}

      {result && (
        <div className="text-sm space-y-1 bg-muted rounded p-3">
          <div>
            Username: <span className="font-semibold">{result.username}</span>
          </div>
          <div>
            Temp Password:{" "}
            <span className="font-mono">{result.tempPassword}</span>
          </div>
        </div>
      )}

      <div className="border-t pt-4 space-y-3">
        <div className="text-sm font-medium">Manage Staff Permissions</div>
        {listStaffQuery.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading staff…</p>
        ) : listStaffQuery.error ? (
          <p className="text-xs text-red-600">{listStaffQuery.error.message}</p>
        ) : listStaffQuery.data && listStaffQuery.data.length > 0 ? (
          <div className="space-y-3">
            {listStaffQuery.data.map((staff) => (
              <div key={staff.id} className="rounded border p-3">
                <div className="text-sm font-semibold mb-2">
                  {staff.username}
                </div>
                {savingUserId === staff.id && (
                  <div className="text-xs text-muted-foreground mb-2">
                    Saving…
                  </div>
                )}
                {!savingUserId && savedStaff[staff.id] && (
                  <div className="text-xs text-emerald-600 mb-2">Saved</div>
                )}
                <div className="grid gap-2">
                  {permissionOptions.map((permission) => (
                    <label
                      key={`${staff.id}-${permission.key}`}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={staff.permissions.includes(permission.key)}
                        onCheckedChange={() =>
                          handleStaffToggle(
                            staff.id,
                            permission.key,
                            staff.permissions,
                          )
                        }
                        disabled={updatePermissionsMutation.isPending}
                      />
                      {permission.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No staff users yet.</p>
        )}
        {saveError && <p className="text-xs text-red-600">{saveError}</p>}
      </div>
    </div>
  );
}
