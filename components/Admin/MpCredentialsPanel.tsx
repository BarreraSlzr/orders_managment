"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Admin-only panel to view all mercadopago_credentials rows and manually
 * upsert a record.  This lets an operator map a known MP user_id to an
 * existing tenant without going through the full OAuth re-flow.
 *
 * Typical use: webhook returns "No tenant found for MP user_id=XXXXX" →
 * find the tenant UUID → fill the form → save → retry simulation.
 */
export function MpCredentialsPanel() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const healthQuery = useQuery(trpc.admin.mpCredentialHealth.queryOptions());

  const upsertMutation = useMutation({
    ...trpc.admin.mpCredentialUpsert.mutationOptions(),
    onSuccess: () => {
      toast.success("Credencial guardada");
      void queryClient.invalidateQueries({
        queryKey: trpc.admin.mpCredentialHealth.queryOptions().queryKey,
      });
      resetForm();
    },
    onError: (err) => {
      toast.error("Error al guardar", {
        description: err instanceof Error ? err.message : "Intenta nuevamente.",
      });
    },
  });

  const tenantsQuery = useQuery(trpc.admin.listTenants.queryOptions());

  const [tenantId, setTenantId] = useState("");
  const [userId, setUserId] = useState("");
  const [appId, setAppId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "error">("active");

  function resetForm() {
    setTenantId("");
    setUserId("");
    setAppId("");
    setAccessToken("");
    setContactEmail("");
    setStatus("active");
  }

  const canSubmit =
    tenantId.trim().length > 0 &&
    userId.trim().length > 0 &&
    appId.trim().length > 0 &&
    accessToken.trim().length > 0 &&
    !upsertMutation.isPending;

  const rows = healthQuery.data?.rows ?? [];

  return (
    <div
      className="space-y-5"
      data-testid={TEST_IDS.MP_CREDENTIALS.PANEL}
    >
      {/* ── Health table ─────────────────────────────────────────────── */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Credenciales registradas</h3>
          <Button
            size="icon"
            variant="ghost"
            className="size-6"
            disabled={healthQuery.isFetching}
            onClick={() => void healthQuery.refetch()}
            aria-label="Actualizar"
          >
            <RefreshCw className={`size-3 ${healthQuery.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {healthQuery.isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="size-3 animate-spin" />
            Cargando…
          </div>
        )}

        {healthQuery.isError && (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            <AlertTriangle className="size-3 shrink-0" />
            No se pudo cargar. Verifica autenticación admin.
          </div>
        )}

        {!healthQuery.isLoading && rows.length === 0 && (
          <p className="text-xs text-muted-foreground py-1">
            Sin registros. Usa el formulario para agregar una credencial.
          </p>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto rounded border text-xs">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Tenant</th>
                  <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">MP user_id</th>
                  <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">App</th>
                  <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t"
                    data-testid={tid(TEST_IDS.MP_CREDENTIALS.ROW, row.id)}
                  >
                    <td className="px-2 py-1.5 font-mono truncate max-w-[120px]">{row.tenantId}</td>
                    <td className="px-2 py-1.5 font-mono">{row.userId}</td>
                    <td className="px-2 py-1.5 font-mono truncate max-w-[80px]">{row.appId}</td>
                    <td className="px-2 py-1.5">
                      {row.isActive ? (
                        <Badge variant="outline" className="text-green-700 border-green-300 gap-1 text-[10px]">
                          <CheckCircle2 className="size-2.5" /> activo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-600 border-red-300 gap-1 text-[10px]">
                          <XCircle className="size-2.5" /> {row.status}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {healthQuery.data && (
          <p className="text-[10px] text-muted-foreground">
            {healthQuery.data.activeCount} activo(s) de {healthQuery.data.summary.total} registro(s).
            {healthQuery.data.inactiveUserIds.length > 0 && (
              <span className="text-amber-600 ml-1">
                Sin mapeo activo: {healthQuery.data.inactiveUserIds.join(", ")}
              </span>
            )}
          </p>
        )}
      </section>

      {/* ── Upsert form ──────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Agregar / actualizar credencial</h3>
        <form
          data-testid={TEST_IDS.MP_CREDENTIALS.UPSERT_FORM}
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            upsertMutation.mutate({
              tenantId,
              userId,
              appId,
              accessToken,
              contactEmail: contactEmail.trim() || undefined,
              status,
            });
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Tenant</Label>
              {tenantsQuery.data && tenantsQuery.data.length > 0 ? (
                <Select value={tenantId} onValueChange={setTenantId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecciona tenant…" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenantsQuery.data.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        {t.name} <span className="text-muted-foreground">({t.id.slice(0, 8)}…)</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="h-8 text-xs font-mono"
                  placeholder="UUID del tenant"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                />
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">MP user_id</Label>
              <Input
                className="h-8 text-xs font-mono"
                placeholder="204005478"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">App ID</Label>
              <Input
                className="h-8 text-xs font-mono"
                placeholder="2318642168506769"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
              />
            </div>

            <div className="col-span-2 space-y-1">
              <Label className="text-xs">
                Access token{" "}
                <span className="text-muted-foreground">(se almacena tal cual)</span>
              </Label>
              <Input
                className="h-8 text-xs font-mono"
                type="password"
                placeholder="APP_USR-…"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Email contacto (opcional)</Label>
              <Input
                className="h-8 text-xs"
                type="email"
                placeholder="cuenta@ejemplo.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Estado</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as "active" | "inactive" | "error")}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active" className="text-xs">active</SelectItem>
                  <SelectItem value="inactive" className="text-xs">inactive</SelectItem>
                  <SelectItem value="error" className="text-xs">error</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            type="submit"
            size="sm"
            className="w-full"
            disabled={!canSubmit}
            data-testid={TEST_IDS.MP_CREDENTIALS.SUBMIT_BTN}
          >
            {upsertMutation.isPending ? (
              <>
                <Loader2 className="size-3 mr-1.5 animate-spin" />
                Guardando…
              </>
            ) : (
              "Guardar credencial"
            )}
          </Button>
        </form>
      </section>
    </div>
  );
}
