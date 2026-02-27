"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminStatus } from "@/hooks/useAdminStatus";
import { useTRPC } from "@/lib/trpc/react";
import { getAvailableWorkflows } from "@/lib/workflows/definitions";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCircle2, CreditCard, Loader2, Pencil, Plus, RefreshCw, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function OnboardingsPage() {
  type RosterUser = {
    id: string;
    username: string;
    role: "manager" | "staff";
    permissions?: string[];
  };
  type SystemRoster = {
    tenants: Array<{
      id: string;
      name: string;
      managers: RosterUser[];
      staff: RosterUser[];
    }>;
  };
  const { isAdmin, role, tenantName, isLoading } = useAdminStatus();
  const effectiveRole = role ?? (isAdmin ? "admin" : "staff");
  const workflows = getAvailableWorkflows(effectiveRole);
  const trpc = useTRPC();
  const isSystemAdmin = role === "admin" && tenantName === "system";
  const [selectedTenantId, setSelectedTenantId] = useState("all");

  const tenantsQuery = useQuery({
    ...trpc.users.listSystemTenants.queryOptions(),
    enabled: !isLoading && isSystemAdmin,
  });

  const systemRosterQuery = useQuery({
    ...trpc.users.listSystemRoster.queryOptions(
      selectedTenantId === "all" ? undefined : { tenantId: selectedTenantId },
    ),
    enabled: !isLoading && isSystemAdmin,
  });

  const tenantRosterQuery = useQuery({
    ...trpc.users.listRoster.queryOptions(),
    enabled: !isLoading && !isSystemAdmin,
  });

  const meQuery = useQuery(trpc.users.me.queryOptions());
  const rosterData = isSystemAdmin
    ? systemRosterQuery.data
    : tenantRosterQuery.data;
  const systemRoster = (rosterData && !Array.isArray(rosterData)
    ? rosterData
    : { tenants: [] }) as SystemRoster;
  const tenantRoster = Array.isArray(rosterData)
    ? (rosterData as RosterUser[])
    : [];
  const currentUserId = meQuery.data?.id ?? null;
  const managers = !isSystemAdmin
    ? tenantRoster.filter((user) => user.role === "manager")
    : [];
  const staff = !isSystemAdmin
    ? tenantRoster.filter((user) => user.role === "staff")
    : [];
  const canEditManagers = role === "admin";
  const canEditStaff = role === "admin" || role === "manager";

  const mpEnvStatusQuery = useQuery({
    ...trpc.admin.mpEnvStatus.queryOptions(),
    enabled: !isLoading && effectiveRole === "admin",
  });

  const staffOnboardHref = "/onboardings/onboard-staff";
  const managerOnboardHref = "/onboardings/onboard-manager";
  const canCreateManager = role === "admin" && isSystemAdmin;
  const canCreateStaff = role === "admin" || role === "manager";
  const canConfigurePlatform = effectiveRole === "admin";
  const canConfigureTenantBilling =
    (effectiveRole === "manager" || effectiveRole === "admin") && !isSystemAdmin;
  const selectedTenant =
    isSystemAdmin && selectedTenantId !== "all"
      ? tenantsQuery.data?.find((tenant) => tenant.id === selectedTenantId)
      : null;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
          Onboarding
        </p>
        <h1 className="font-[var(--font-onboarding)] text-3xl text-slate-900">
          Workflow Runner
        </h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Launch role-based onboarding flows.
        </p>
      </header>

      {isSystemAdmin && (
        <section className="rounded-2xl border border-slate-200 bg-white/70 p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Tenant filter
              </h3>
              <p className="text-xs text-slate-500">
                Applies to roster + staff creation.
              </p>
            </div>
            <div className="w-full md:w-64">
              <Select
                value={selectedTenantId}
                onValueChange={setSelectedTenantId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All tenants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tenants</SelectItem>
                  {(tenantsQuery.data ?? []).map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>
      )}

      {/* ── Platform Configuration (admin-only) ─────────────────────── */}
      {!isLoading && canConfigurePlatform && (
        <section className="rounded-2xl border border-slate-200 bg-white/70 p-6">
          <h3 className="font-[var(--font-onboarding)] text-lg text-slate-900">
            Configuración de plataforma
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Configura las integraciones de la plataforma antes de habilitar cobros.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <MpEnvWorkflowCard
              envStatus={
                mpEnvStatusQuery.data?.ok
                  ? mpEnvStatusQuery.data.vars
                  : null
              }
              isLoading={mpEnvStatusQuery.isLoading}
              isError={mpEnvStatusQuery.isError || mpEnvStatusQuery.data?.ok === false}
              onRetry={() => void mpEnvStatusQuery.refetch()}
            />
          </div>
        </section>
      )}

      {!isLoading && canConfigureTenantBilling && (
        <section className="rounded-2xl border border-slate-200 bg-white/70 p-6">
          <h3 className="font-[var(--font-onboarding)] text-lg text-slate-900">
            Suscripción del tenant
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Activa la suscripción con tu propia sesión de tenant usando el email OAuth vinculado en Settings.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-white/90 p-5">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-violet-600" />
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Billing
                </span>
              </div>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                Activar suscripción
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Se asigna automáticamente al tenant de tu sesión, sin selección manual de tenant.
              </p>
              <div className="mt-4">
                <Link
                  href="/onboardings/configure-mp-billing"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-900 px-3 py-1 text-xs font-semibold text-slate-900 transition hover:bg-slate-900 hover:text-white"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  Configurar billing
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="rounded-xl border bg-white/80 p-6 text-sm text-slate-500">
          Loading workflows...
        </div>
      ) : workflows.length === 0 ? (
        <div className="rounded-xl border bg-white/80 p-6 text-sm text-slate-600">
          No workflows for your role.
        </div>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white/70 p-6">
          <h3 className="font-[var(--font-onboarding)] text-lg text-slate-900">
            Core roles
          </h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-white/90 p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Manager
              </div>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                Runs the team
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Creates staff, manages inventory, and oversees orders.
              </p>
              <div className="mt-4">
                <Link
                  href={managerOnboardHref}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    canCreateManager
                      ? "border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white"
                      : "cursor-not-allowed border-slate-200 text-slate-400"
                  }`}
                  aria-disabled={!canCreateManager}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create manager
                </Link>
                {!canCreateManager && (
                  <p className="mt-2 text-xs text-slate-400">
                    System admins only.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border bg-white/90 p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Staff
              </div>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                Daily ops
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Handles orders and assigned operational tasks.
              </p>
              <div className="mt-4">
                <Link
                  href={
                    isSystemAdmin && selectedTenant
                      ? `/onboardings/onboard-staff?tenantId=${
                          selectedTenant.id
                        }&tenant=${encodeURIComponent(selectedTenant.name)}`
                      : staffOnboardHref
                  }
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    canCreateStaff
                      ? "border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white"
                      : "cursor-not-allowed border-slate-200 text-slate-400"
                  }`}
                  aria-disabled={!canCreateStaff}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create staff
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-6">
        <div className="flex flex-col gap-2">
          <h3 className="font-[var(--font-onboarding)] text-lg text-slate-900">
            Team roster
          </h3>
          <p className="text-sm text-slate-500">Read-only overview.</p>
        </div>

        {(isSystemAdmin ? (
          systemRosterQuery.isLoading
        ) : (
          tenantRosterQuery.isLoading
        )) ? (
          <div className="mt-4 text-sm text-slate-500">Loading roster...</div>
        ) : (isSystemAdmin ? (
            systemRosterQuery.error
          ) : (
            tenantRosterQuery.error
          )) ? (
          <div className="mt-4 text-sm text-red-600">
            {
              (isSystemAdmin
                ? systemRosterQuery.error
                : tenantRosterQuery.error
              )?.message
            }
          </div>
        ) : isSystemAdmin && systemRoster.tenants.length === 0 ? (
          <div className="mt-4 text-sm text-slate-500">No teams found.</div>
        ) : !isSystemAdmin && tenantRoster.length === 0 ? (
          <div className="mt-4 text-sm text-slate-500">No users found.</div>
        ) : isSystemAdmin ? (
          <div className="mt-4 grid gap-4">
            {systemRoster.tenants.map((tenant) => (
              <div
                key={tenant.id}
                className="rounded-2xl border bg-white/90 p-5"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-[var(--font-onboarding)] text-base text-slate-900">
                    {tenant.name}
                  </h4>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/onboardings/onboard-manager?tenant=${encodeURIComponent(
                        tenant.name,
                      )}`}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-900 px-3 py-1 text-xs font-semibold text-slate-900 transition hover:bg-slate-900 hover:text-white"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add manager
                    </Link>
                    <Link
                      href={`/onboardings/onboard-staff?tenantId=${
                        tenant.id
                      }&tenant=${encodeURIComponent(tenant.name)}`}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add staff
                    </Link>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border bg-white/90 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Managers
                    </div>
                    {tenant.managers.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-500">
                        No managers listed.
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-2 text-sm">
                        {tenant.managers.map((user) => (
                          <li
                            key={user.id}
                            className="group flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                          >
                            <span className="text-slate-800">
                              {user.username}
                            </span>
                            <span className="flex items-center gap-2 text-xs text-slate-500">
                              {currentUserId === user.id && (
                                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                                  Me
                                </span>
                              )}
                              <span>Manager</span>
                            </span>
                            {canEditManagers && (
                              <Link
                                href={`/onboardings/onboard-manager?userId=${
                                  user.id
                                }&tenant=${encodeURIComponent(tenant.name)}`}
                                className="ml-2 inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 opacity-0 transition group-hover:opacity-100"
                              >
                                <Pencil className="h-3 w-3" />
                                Edit
                              </Link>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-xl border bg-white/90 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Staff
                    </div>
                    {tenant.staff.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-500">
                        No staff listed.
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-2 text-sm">
                        {tenant.staff.map((user) => (
                          <li
                            key={user.id}
                            className="group flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                          >
                            <span className="text-slate-800">
                              {user.username}
                            </span>
                            <span className="flex items-center gap-2 text-xs text-slate-500">
                              {currentUserId === user.id && (
                                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                                  Me
                                </span>
                              )}
                              <span>Staff</span>
                            </span>
                            {canEditStaff && (
                              <Link
                                href={`/onboardings/onboard-staff?userId=${
                                  user.id
                                }&tenantId=${
                                  tenant.id
                                }&tenant=${encodeURIComponent(tenant.name)}`}
                                className="ml-2 inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 opacity-0 transition group-hover:opacity-100"
                              >
                                <Pencil className="h-3 w-3" />
                                Edit
                              </Link>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border bg-white/90 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Managers
              </div>
              {managers.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  No managers listed.
                </p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {managers.map((user) => (
                    <li
                      key={user.id}
                      className="group flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <span className="text-slate-800">{user.username}</span>
                      <span className="flex items-center gap-2 text-xs text-slate-500">
                        {currentUserId === user.id && (
                          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                            Me
                          </span>
                        )}
                        <span>Manager</span>
                      </span>
                      {canEditManagers && (
                        <Link
                          href={`/onboardings/onboard-manager?userId=${
                            user.id
                          }&tenant=${encodeURIComponent(tenantName ?? "")}`}
                          className="ml-2 inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 opacity-0 transition group-hover:opacity-100"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border bg-white/90 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Staff
              </div>
              {staff.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No staff listed.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {staff.map((user) => (
                    <li
                      key={user.id}
                      className="group flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <span className="text-slate-800">{user.username}</span>
                      <span className="flex items-center gap-2 text-xs text-slate-500">
                        {currentUserId === user.id && (
                          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                            Me
                          </span>
                        )}
                        <span>Staff</span>
                      </span>
                      {canEditStaff && (
                        <Link
                          href={`/onboardings/onboard-staff?userId=${
                            user.id
                          }&tenant=${encodeURIComponent(tenantName ?? "")}`}
                          className="ml-2 inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 opacity-0 transition group-hover:opacity-100"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ── MP Env Workflow Card ──────────────────────────────────────────────────────

interface MpEnvStatus {
  MP_CLIENT_ID: boolean;
  MP_CLIENT_SECRET: boolean;
  MP_REDIRECT_URI: boolean;
  MP_WEBHOOK_SECRET: boolean;
  MP_BILLING_WEBHOOK_SECRET: boolean;
  MP_TOKENS_ENCRYPTION_KEY: boolean;
}

function MpEnvWorkflowCard({
  envStatus,
  isLoading = false,
  isError = false,
  onRetry,
}: {
  envStatus: MpEnvStatus | null;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}) {
  // Count configured required keys
  const requiredKeys: (keyof MpEnvStatus)[] = [
    "MP_CLIENT_ID",
    "MP_CLIENT_SECRET",
    "MP_REDIRECT_URI",
    "MP_WEBHOOK_SECRET",
  ];
  const optionalKeys: (keyof MpEnvStatus)[] = [
    "MP_BILLING_WEBHOOK_SECRET",
    "MP_TOKENS_ENCRYPTION_KEY",
  ];

  const requiredConfigured = envStatus
    ? requiredKeys.filter((k) => envStatus[k]).length
    : 0;
  const allRequiredSet = requiredConfigured === requiredKeys.length;
  const optionalConfigured = envStatus
    ? optionalKeys.filter((k) => envStatus[k]).length
    : 0;

  return (
    <div className="rounded-2xl border bg-white/90 p-5">
      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-sky-600" />
        <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
          Mercado Pago
        </span>
      </div>
      <h2 className="mt-2 text-xl font-semibold text-slate-900">
        Configurar credenciales
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Client ID, secretos de webhook y claves de cifrado para habilitar cobros.
      </p>

      {/* Loading state */}
      {isLoading && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Cargando estado del servidor...
        </div>
      )}

      {/* Error state */}
      {!isLoading && isError && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-amber-800">
                No se pudo cargar el estado de las variables
              </p>
              <p className="mt-0.5 text-[11px] text-amber-700">
                Verifica que la clave de administrador esté configurada correctamente.
              </p>
            </div>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-700 hover:text-amber-900"
            >
              <RefreshCw className="h-3 w-3" />
              Reintentar
            </button>
          )}
        </div>
      )}

      {/* Live env status */}
      {!isLoading && !isError && envStatus && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-widest text-slate-400">
            Estado del servidor
          </p>
          <div className="flex flex-wrap gap-1.5">
            {requiredKeys.map((key) => (
              <span
                key={key}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  envStatus[key]
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-600"
                }`}
              >
                {envStatus[key] ? (
                  <CheckCircle2 className="h-2.5 w-2.5" />
                ) : (
                  <XCircle className="h-2.5 w-2.5" />
                )}
                {key.replace("MP_", "")}
              </span>
            ))}
            {optionalKeys.map((key) => (
              <span
                key={key}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  envStatus[key]
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {envStatus[key] ? (
                  <CheckCircle2 className="h-2.5 w-2.5" />
                ) : (
                  <XCircle className="h-2.5 w-2.5" />
                )}
                {key.replace("MP_", "")}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <Link
          href="/onboardings/configure-mp-env"
          className="inline-flex items-center gap-2 rounded-full border border-slate-900 px-3 py-1 text-xs font-semibold text-slate-900 transition hover:bg-slate-900 hover:text-white"
        >
          {allRequiredSet ? (
            <>
              <Pencil className="h-3.5 w-3.5" />
              Revisar configuración
            </>
          ) : (
            <>
              <ArrowRight className="h-3.5 w-3.5" />
              Configurar
            </>
          )}
        </Link>
        {allRequiredSet && (
          <p className="mt-2 text-xs text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Requeridas completas
            {optionalConfigured > 0 &&
              ` + ${optionalConfigured} opcional${optionalConfigured > 1 ? "es" : ""}`}
          </p>
        )}
        {!allRequiredSet && envStatus && (
          <p className="mt-2 text-xs text-amber-600">
            {requiredConfigured}/{requiredKeys.length} variables requeridas configuradas.
            Requiere redeploy después de guardar.
          </p>
        )}
      </div>
    </div>
  );
}
