"use client";

import { MpCredentialsPanel } from "@/components/Admin/MpCredentialsPanel";
import { WorkflowRunner } from "@/components/Workflows/WorkflowRunner";
import {
  CsvImportStep,
  ManagerInfoStep,
  MpEnvReviewStep,
  MpOAuthStep,
  MpTokensStep,
  MpWebhooksStep,
  PermissionsStep,
  ReviewStep,
  StaffInfoStep,
  TenantInfoStep,
} from "@/components/Workflows/steps";
import { useAdminStatus } from "@/hooks/useAdminStatus";
import { useTRPC } from "@/lib/trpc/react";
import {
  getAvailableWorkflows,
  getWorkflowDefinition,
  WorkflowDefinition,
} from "@/lib/workflows/definitions";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { z } from "zod";

interface CompletionState {
  title: string;
  subtitle: string;
  details: Array<{ label: string; value: string }>;
}

export default function OnboardingRunnerPage() {
  const params = useParams();
  const workflowId = Array.isArray(params.workflow)
    ? params.workflow[0]
    : params.workflow;

  const { isAdmin, role, tenantName, isLoading } = useAdminStatus();
  const effectiveRole = role ?? (isAdmin ? "admin" : "staff");
  const definition = getWorkflowDefinition(
    typeof workflowId === "string" ? workflowId : "",
  );
  const isSystemAdmin = role === "admin" && tenantName === "system";

  const available = getAvailableWorkflows(effectiveRole).some(
    (workflow) => workflow.id === definition?.id,
  );

  const trpc = useTRPC();
  const onboardManagerMutation = useMutation(
    trpc.admin.onboardManager.mutationOptions(),
  );
  const importTenantProductsMutation = useMutation(
    trpc.admin.importTenantProducts.mutationOptions(),
  );
  const onboardTenantManagerMutation = useMutation(
    trpc.users.onboardTenantManager.mutationOptions(),
  );
  const onboardStaffMutation = useMutation(
    trpc.users.onboardStaff.mutationOptions(),
  );

  const mpEnvStatusQuery = useQuery({
    ...trpc.admin.mpEnvStatus.queryOptions(),
    enabled: !isLoading,
  });
  const onboardTenantStaffMutation = useMutation(
    trpc.users.onboardTenantStaff.mutationOptions(),
  );
  const updateUserProfileMutation = useMutation(
    trpc.users.updateUserProfile.mutationOptions(),
  );

  const [tenantParam] = useQueryState("tenant");
  const [tenantIdParam] = useQueryState("tenantId");
  const [managerParam] = useQueryState("manager");
  const [usernameParam] = useQueryState("username");
  const [permissionsParam] = useQueryState("permissions");
  const [userIdParam] = useQueryState("userId");

  const [completion, setCompletion] = useState<CompletionState | null>(null);
  const isEditMode = Boolean(userIdParam);

  const editableUserQuery = useQuery({
    ...trpc.users.getEditableUser.queryOptions({
      userId: userIdParam ?? "",
    }),
    enabled: Boolean(userIdParam),
  });

  const editableUser = editableUserQuery.data ?? null;
  const isReadOnly = isEditMode && editableUser?.role === "staff";
  const defaultStaffPermissions = [
    "orders.create",
    "orders.update",
    "orders.delete",
    "orders.close",
  ];
  const defaultManagerPermissions = [
    ...defaultStaffPermissions,
    "products.create",
    "products.update",
    "products.delete",
    "inventory.items.view",
    "inventory.items.update",
    "inventory.transactions.view",
    "inventory.transactions.create",
    "reports.view",
    "users.manage",
  ];

  const workflowDefinition = useMemo(() => {
    if (!definition) return null;

    if (definition.id === "onboard-manager" && isEditMode) {
      const permissionsStep = {
        id: "permissions",
        title: "Set Permissions",
        description: "Configure manager access level",
        schema: z
          .object({
            permissions: z
              .array(z.string())
              .min(1, "Select at least one permission"),
          })
          .passthrough(),
      };

      const baseSteps = definition.steps.filter(
        (step) => step.id !== "csv-import",
      );
      const reviewIndex = baseSteps.findIndex((step) => step.id === "review");
      const steps = [...baseSteps];
      if (reviewIndex >= 0) {
        steps.splice(reviewIndex, 0, permissionsStep);
      } else {
        steps.push(permissionsStep);
      }

      return { ...definition, steps };
    }

    return definition;
  }, [definition, isEditMode]);

  const initialData = useMemo(() => {
    const basePermissions = permissionsParam
      ? permissionsParam
          .split(",")
          .map((permission) => permission.trim())
          .filter(Boolean)
      : defaultStaffPermissions;

    if (workflowDefinition?.id === "onboard-manager") {
      return {
        tenantName: editableUser?.tenant_name ?? tenantParam ?? "",
        managerUsername: editableUser?.username ?? managerParam ?? "",
        readOnlyTenant: Boolean(editableUser),
        permissions: editableUser?.permissions?.length
          ? editableUser.permissions
          : defaultManagerPermissions,
        permissionScope: "manager",
        readOnlyUser: isReadOnly,
        confirmCreation: isEditMode ? true : undefined,
      };
    }

    if (workflowDefinition?.id === "onboard-staff") {
      return {
        tenantId: editableUser?.tenant_id ?? tenantIdParam ?? "",
        tenantName: editableUser?.tenant_name ?? tenantParam ?? "",
        username: editableUser?.username ?? usernameParam ?? "",
        permissions: editableUser?.permissions?.length
          ? editableUser.permissions
          : basePermissions,
        permissionScope: "staff",
        readOnlyUser: isReadOnly,
        confirmCreation: isEditMode ? true : undefined,
      };
    }

    return {};
  }, [
    workflowDefinition?.id,
    editableUser,
    isReadOnly,
    managerParam,
    permissionsParam,
    tenantIdParam,
    tenantParam,
    usernameParam,
  ]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border bg-white/80 p-6 text-sm text-slate-500">
        Loading workflow...
      </div>
    );
  }

  if (isEditMode && editableUserQuery.isLoading) {
    return (
      <div className="rounded-2xl border bg-white/80 p-6 text-sm text-slate-500">
        Loading user details...
      </div>
    );
  }

  if (isEditMode && editableUserQuery.error) {
    return (
      <div className="rounded-2xl border bg-white/80 p-6 text-sm text-red-600">
        {editableUserQuery.error.message}
      </div>
    );
  }

  if (!workflowDefinition) {
    return (
      <div className="rounded-2xl border bg-white/80 p-6 text-sm text-slate-600">
        Unknown workflow. <Link href="/onboardings">Return to list</Link>.
      </div>
    );
  }

  if (!available) {
    return (
      <div className="rounded-2xl border bg-white/80 p-6 text-sm text-slate-600">
        You do not have access to this onboarding workflow.{" "}
        <Link href="/onboardings">Return to list</Link>.
      </div>
    );
  }

  const handleComplete = async (data: Record<string, unknown>) => {
    if (workflowDefinition.id === "onboard-manager") {
      const tenantNameValue = String(data.tenantName || "");
      const managerUsername = String(data.managerUsername || "");
      const tempPassword =
        typeof data.tempPassword === "string" && data.tempPassword.trim()
          ? data.tempPassword
          : undefined;
      const permissions = Array.isArray(data.permissions)
        ? (data.permissions as string[])
        : undefined;

      const result =
        isEditMode && userIdParam
          ? await updateUserProfileMutation.mutateAsync({
              userId: userIdParam,
              username: managerUsername,
              tempPassword,
              permissions,
            })
          : isSystemAdmin
          ? await onboardTenantManagerMutation.mutateAsync({
              tenantName: tenantNameValue,
              managerUsername,
              tempPassword,
            })
          : await onboardManagerMutation.mutateAsync({
              tenantName: tenantNameValue,
              managerUsername,
              tempPassword,
            });

      if (!isEditMode) {
        const csv = typeof data.csv === "string" ? data.csv.trim() : "";
        if (csv && "tenantId" in result) {
          await importTenantProductsMutation.mutateAsync({
            tenantId: result.tenantId,
            csv,
          });
        }
      }

      const createdTenantName =
        !isEditMode && "tenantName" in result
          ? result.tenantName
          : tenantNameValue;
      const createdTempPassword =
        !isEditMode && "tempPassword" in result ? result.tempPassword : "";

      setCompletion({
        title: isEditMode ? "Manager updated" : "Tenant and manager created",
        subtitle: isEditMode
          ? "Changes saved successfully."
          : "Save the temp password before closing this page.",
        details: isEditMode
          ? [
              {
                label: "Tenant",
                value: editableUser?.tenant_name ?? createdTenantName,
              },
              { label: "Manager", value: result.username },
            ]
          : [
              { label: "Tenant", value: createdTenantName },
              { label: "Manager", value: result.username },
              { label: "Temp password", value: createdTempPassword },
            ],
      });
      return;
    }

    if (workflowDefinition.id === "onboard-staff") {
      const username = String(data.username || "");
      const tempPassword =
        typeof data.tempPassword === "string" && data.tempPassword.trim()
          ? data.tempPassword
          : undefined;
      const permissions = Array.isArray(data.permissions)
        ? (data.permissions as string[])
        : ["orders.create", "orders.update", "orders.delete", "orders.close"];
      const targetTenantId =
        typeof data.tenantId === "string" ? data.tenantId : "";
      const targetTenantName =
        typeof data.tenantName === "string" ? data.tenantName : "";

      const result =
        isEditMode && userIdParam
          ? await updateUserProfileMutation.mutateAsync({
              userId: userIdParam,
              username,
              tempPassword,
              permissions,
            })
          : targetTenantId && isSystemAdmin
          ? await onboardTenantStaffMutation.mutateAsync({
              tenantId: targetTenantId,
              username,
              tempPassword,
              permissions,
            })
          : await onboardStaffMutation.mutateAsync({
              username,
              tempPassword,
              permissions,
            });

      const createdTempPassword =
        !isEditMode && "tempPassword" in result ? result.tempPassword : "";

      setCompletion({
        title: isEditMode ? "Staff member updated" : "Staff member created",
        subtitle: isEditMode
          ? "Changes saved successfully."
          : "Share the temp password with the staff member.",
        details: isEditMode
          ? [
              {
                label: "Tenant",
                value: editableUser?.tenant_name ?? targetTenantName,
              },
              { label: "Username", value: result.username },
            ]
          : [
              ...(targetTenantName
                ? [{ label: "Tenant", value: targetTenantName }]
                : []),
              { label: "Username", value: result.username },
              { label: "Temp password", value: createdTempPassword },
            ],
      });
    }

    if (workflowDefinition.id === "configure-mp-env") {
      // No server-side call needed — the admin copies the generated .env block
      // to their hosting environment settings.
      setCompletion({
        title: "Configuración lista",
        subtitle:
          "Copia el bloque .env del paso de revisión en Vercel / tu hosting y redesplegado.",
        details: [
          { label: "MP_CLIENT_ID", value: String(data.MP_CLIENT_ID || "") || "—" },
          { label: "MP_WEBHOOK_SECRET", value: data.MP_WEBHOOK_SECRET ? "✓ provisto" : "—" },
          { label: "MP_BILLING_WEBHOOK_SECRET", value: data.MP_BILLING_WEBHOOK_SECRET ? "✓ provisto" : "—" },
          { label: "MP_TOKENS_ENCRYPTION_KEY", value: data.MP_TOKENS_ENCRYPTION_KEY ? "✓ provisto" : "—" },
        ],
      });
    }
  };

  if (completion) {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-2xl border bg-white/90 p-6 shadow-sm">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Completed
          </div>
          <h2 className="font-[var(--font-onboarding)] text-2xl text-slate-900">
            {completion.title}
          </h2>
          <p className="mt-2 text-sm text-slate-600">{completion.subtitle}</p>
          <div className="mt-4 space-y-2 text-sm">
            {completion.details.map((item) => (
              <div key={item.label} className="flex justify-between gap-4">
                <span className="text-slate-500">{item.label}</span>
                <span className="font-semibold text-slate-900">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/onboardings"
            className="rounded-full border border-slate-900 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-900 hover:text-white"
          >
            Back to workflows
          </Link>
          <Link
            href={`/onboardings/${workflowDefinition.id}`}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:border-slate-400"
          >
            Start again
          </Link>
        </div>
      </div>
    );
  }

  const renderStep = ({
    step,
    data,
    onChange,
  }: {
    step: WorkflowDefinition["steps"][number];
    data: Record<string, unknown>;
    onChange: (params: { data: Record<string, unknown> }) => void;
  }) => {
    switch (step.id) {
      case "tenant-info":
        return <TenantInfoStep data={data} onChange={onChange} />;
      case "manager-info":
        return <ManagerInfoStep data={data} onChange={onChange} />;
      case "csv-import":
        return <CsvImportStep data={data} onChange={onChange} />;
      case "staff-info":
        return <StaffInfoStep data={data} onChange={onChange} />;
      case "permissions":
        return <PermissionsStep data={data} onChange={onChange} />;
      case "mp-oauth":
        return <MpOAuthStep data={data} onChange={onChange} />;
      case "mp-webhooks":
        return <MpWebhooksStep data={data} onChange={onChange} />;
      case "mp-tokens":
        return <MpTokensStep data={data} onChange={onChange} />;
      case "mp-credentials":
        return <MpCredentialsPanel />;
      case "env-review":
        return (
          <MpEnvReviewStep
            data={data}
            envStatus={
              mpEnvStatusQuery.data?.ok
                ? mpEnvStatusQuery.data.vars
                : null
            }
            isError={mpEnvStatusQuery.isError || mpEnvStatusQuery.data?.ok === false}
            onRetry={() => void mpEnvStatusQuery.refetch()}
            onChange={onChange}
          />
        );
      case "review": {
        const details =
          workflowDefinition.id === "onboard-manager"
            ? [
                {
                  label: "Tenant",
                  value: String(data.tenantName || ""),
                },
                {
                  label: "Manager",
                  value: String(data.managerUsername || ""),
                },
                ...(Array.isArray(data.permissions)
                  ? [
                      {
                        label: "Permissions",
                        value: (data.permissions as string[]).join(", "),
                      },
                    ]
                  : []),
                ...(!isEditMode
                  ? [
                      {
                        label: "CSV import",
                        value:
                          typeof data.csv === "string" && data.csv.trim()
                            ? "Included"
                            : "Skipped",
                      },
                    ]
                  : []),
              ]
            : [
                {
                  label: "Staff username",
                  value: String(data.username || ""),
                },
                {
                  label: "Permissions",
                  value: Array.isArray(data.permissions)
                    ? (data.permissions as string[]).join(", ")
                    : "Default",
                },
              ];

        return (
          <ReviewStep
            data={data}
            title={workflowDefinition.title}
            items={details}
            onChange={onChange}
          />
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          {workflowDefinition.requiredRole.toUpperCase()} workflow
        </p>
        <h1 className="font-[var(--font-onboarding)] text-3xl text-slate-900">
          {workflowDefinition.title}
        </h1>
        <p className="text-sm text-slate-600">
          {workflowDefinition.description}
        </p>
      </div>

      <WorkflowRunner
        key={`${workflowDefinition.id}-${isEditMode ? userIdParam : "new"}`}
        definition={workflowDefinition}
        initialData={initialData}
        onComplete={handleComplete}
        renderStep={renderStep}
        isReadOnly={isReadOnly}
      />

      <div className="text-xs text-slate-500">
        Need a different workflow?{" "}
        <Link href="/onboardings">Return to list</Link>.
      </div>
    </div>
  );
}
