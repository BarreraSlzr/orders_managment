"use client";

import { parseProductsCSV, type ProductRow } from "@/lib/utils/parseProductsCSV";
import { AlertCircle, CheckCircle } from "lucide-react";
import { useMemo } from "react";

interface CSVPreviewTableProps {
  csv: string;
}

export function CSVPreviewTable({ csv }: CSVPreviewTableProps) {
  const parsed = useMemo(() => parseProductsCSV({ csv }), [csv]);

  if (parsed.rows.length === 0 && parsed.errors.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No data found in CSV.</p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex gap-4 text-sm">
        {parsed.rows.length > 0 && (
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle className="h-3.5 w-3.5" />
            {parsed.rows.length} valid row(s)
          </span>
        )}
        {parsed.errors.length > 0 && (
          <span className="flex items-center gap-1 text-red-600">
            <AlertCircle className="h-3.5 w-3.5" />
            {parsed.errors.length} error(s)
          </span>
        )}
        <span className="text-muted-foreground">
          {parsed.totalLines} total line(s)
        </span>
      </div>

      {/* Errors */}
      {parsed.errors.length > 0 && (
        <div className="max-h-32 overflow-y-auto rounded border border-red-200 bg-red-50 p-2">
          <ul className="space-y-1 text-xs">
            {parsed.errors.map((err, idx) => (
              <li key={idx} className="font-mono text-red-700">
                {err.line > 0 && <span className="font-semibold">Línea {err.line}: </span>}
                {err.message}
                {err.raw && (
                  <span className="block text-red-400 truncate">{err.raw}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Table preview */}
      {parsed.rows.length > 0 && (
        <div className="max-h-64 overflow-auto rounded border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-100">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium text-slate-600">#</th>
                <th className="px-2 py-1.5 text-left font-medium text-slate-600">Nombre</th>
                <th className="px-2 py-1.5 text-right font-medium text-slate-600">Precio</th>
                <th className="px-2 py-1.5 text-left font-medium text-slate-600">Tags</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {parsed.rows.map((row: ProductRow, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-2 py-1 text-muted-foreground">{idx + 1}</td>
                  <td className="px-2 py-1 font-medium">{row.name}</td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    ${(row.price / 100).toFixed(2)}
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex flex-wrap gap-1">
                      {row.tags.split(",").filter(Boolean).map((tag, i) => (
                        <span
                          key={i}
                          className="inline-block rounded bg-slate-200 px-1.5 py-0.5 text-[10px]"
                        >
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
