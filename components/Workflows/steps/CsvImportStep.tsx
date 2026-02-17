"use client";

import { CSVPreviewTable } from "@/components/Admin/CSVPreviewTable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCallback, useRef } from "react";

interface CsvImportStepProps {
  data: Record<string, unknown>;
  onChange: (params: { data: Record<string, unknown> }) => void;
}

export function CsvImportStep({ data, onChange }: CsvImportStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csv = typeof data.csv === "string" ? data.csv : "";

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        onChange({ data: { csv: "" } });
        return;
      }

      if (!file.name.endsWith(".csv")) {
        onChange({ data: { csv: "" } });
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const text =
          typeof ev.target?.result === "string" ? ev.target.result : "";
        onChange({ data: { csv: text } });
      };
      reader.readAsText(file, "utf-8");
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    onChange({ data: { csv: "" } });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [onChange]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        CSV format: name,price,tags
      </div>

      <div>
        <Label htmlFor="csv-file">CSV file (optional)</Label>
        <Input
          ref={fileInputRef}
          id="csv-file"
          type="file"
          accept=".csv"
          onChange={handleFileChange}
        />
      </div>

      {csv && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700">Preview</div>
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Clear
            </button>
          </div>
          <CSVPreviewTable csv={csv} />
        </div>
      )}
    </div>
  );
}
