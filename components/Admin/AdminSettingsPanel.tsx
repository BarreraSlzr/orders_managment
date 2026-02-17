"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTRPC } from "@/lib/trpc/react";
import { getIsoTimestamp } from "@/utils/stamp";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle,
  Download,
  FileText,
  RefreshCw,
  Settings,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { CSVPreviewTable } from "./CSVPreviewTable";

type Tab = "csv" | "export" | "links";

export function AdminSettingsPanel({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>("csv");

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "csv", label: "CSV Import" },
    { key: "export", label: "Export" },
    { key: "links", label: "Links" },
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
          {activeTab === "links" && <QuickLinksTab />}
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

// ── Quick Links Tab ───────────────────────────────────────────────────────

function QuickLinksTab() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Jump to onboarding workflows or inventory management.
      </p>
      <div className="flex flex-col gap-2">
        <Button asChild size="sm">
          <Link href="/onboardings">Go to Onboarding</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/items">Go to Inventory</Link>
        </Button>
      </div>
    </div>
  );
}
