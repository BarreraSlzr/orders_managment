"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTRPC } from "@/lib/trpc/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle, FileText, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";

interface UploadResult {
  imported: number;
  skipped: number;
  errors: Array<{ line: number; raw: string; message: string }>;
  totalLines: number;
}

export function CSVUpload() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  const uploadMutation = useMutation(trpc.products.csvUpload.mutationOptions());

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
        setResult({
          imported: 0,
          skipped: 0,
          totalLines: 0,
          errors: [
            {
              line: 0,
              raw: file.name,
              message: "Only .csv files are accepted",
            },
          ],
        });
        return;
      }

      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = (ev) => {
        setCsvContent(ev.target?.result as string);
      };
      reader.readAsText(file, "utf-8");
    },
    [],
  );

  const handleUpload = useCallback(async () => {
    if (!csvContent) return;

    try {
      const uploadResult = await uploadMutation.mutateAsync({
        csv: csvContent,
      });
      setResult(uploadResult);

      if (uploadResult.imported > 0) {
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

  const handleReset = useCallback(() => {
    setFileName(null);
    setCsvContent(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Importar Productos (CSV)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Format hint */}
        <div className="text-xs text-muted-foreground bg-muted rounded p-2 font-mono">
          <p className="font-semibold mb-1">Formato CSV:</p>
          <p>name,price,tags</p>
          <p>&quot;Ensalada Panela&quot;,10500,&quot;ensalada,panela&quot;</p>
        </div>

        {/* File input */}
        <div className="space-y-2">
          <Label htmlFor="csv-file">Archivo CSV</Label>
          <Input
            ref={fileInputRef}
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
          />
        </div>

        {/* File preview */}
        {fileName && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            {fileName}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={handleUpload}
            disabled={!csvContent || uploadMutation.isPending}
          >
            {uploadMutation.isPending ? "Importando…" : "Importar"}
          </Button>
          <Button variant="outline" onClick={handleReset}>
            Limpiar
          </Button>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-2 text-sm">
            {result.imported > 0 && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                {result.imported} producto(s) importado(s)
              </div>
            )}

            {result.skipped > 0 && (
              <div className="text-yellow-600">
                {result.skipped} fila(s) omitida(s)
              </div>
            )}

            {result.errors.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-red-600 font-medium">
                  <AlertCircle className="h-4 w-4" />
                  {result.errors.length} error(es)
                </div>
                <ul className="text-xs text-muted-foreground space-y-1 max-h-40 overflow-y-auto">
                  {result.errors.map((err, idx) => (
                    <li
                      key={idx}
                      className="font-mono bg-muted rounded px-2 py-1"
                    >
                      {err.line > 0 && <span>Línea {err.line}: </span>}
                      {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
