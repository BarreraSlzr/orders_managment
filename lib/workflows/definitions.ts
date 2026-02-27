import { z } from "zod";

/**
 * LEGEND: Workflow definitions for multi-step onboarding processes.
 * These are client-side schema definitions that define step structure,
 * validation rules, and metadata for WorkflowRunner orchestrator.
 */

export interface WorkflowStep {
  id: string;
  title: string;
  description?: string;
  schema: z.ZodSchema;
  optional?: boolean;
}

export interface WorkflowDefinition {
  id: string;
  title: string;
  description: string;
  requiredRole: "admin" | "manager" | "staff";
  steps: WorkflowStep[];
}

/**
 * Superadmin creates new tenant + manager user
 * Workflow: Tenant Info → Manager Info → Review
 */
export const onboardManagerWorkflow: WorkflowDefinition = {
  id: "onboard-manager",
  title: "Onboard Manager & Tenant",
  description: "Create a new tenant and its first manager user",
  requiredRole: "admin",
  steps: [
    {
      id: "tenant-info",
      title: "Create Tenant",
      description: "Define the business tenant details",
      schema: z.object({
        tenantName: z
          .string()
          .min(3, "Tenant name must be at least 3 characters")
          .max(100, "Tenant name must be less than 100 characters"),
      }),
    },
    {
      id: "manager-info",
      title: "Create Manager",
      description: "Set up the manager account",
      schema: z.object({
        managerUsername: z
          .string()
          .min(3, "Manager username must be at least 3 characters"),
        tempPassword: z
          .string()
          .min(8, "Temp password must be at least 8 characters")
          .optional(),
      }),
    },
    {
      id: "csv-import",
      title: "Optional CSV Import",
      description: "Seed initial products for the new tenant",
      schema: z.object({
        csv: z.string().optional(),
      }),
      optional: true,
    },
    {
      id: "review",
      title: "Review & Confirm",
      description: "Verify all details before creation",
      schema: z.object({
        confirmCreation: z
          .boolean()
          .refine((v) => v === true, "You must confirm to proceed"),
      }),
    },
  ],
};

/**
 * Manager creates staff user + sets permissions
 * Workflow: Staff Info → Permissions → Review
 */
export const onboardStaffWorkflow: WorkflowDefinition = {
  id: "onboard-staff",
  title: "Onboard Staff",
  description: "Create staff user with role and permissions",
  requiredRole: "manager",
  steps: [
    {
      id: "staff-info",
      title: "Create Staff",
      description: "Set up staff user account",
      schema: z.object({
        username: z
          .string()
          .min(3, "Username must be at least 3 characters"),
        tempPassword: z
          .string()
          .min(8, "Temp password must be at least 8 characters")
          .optional(),
      }),
    },
    {
      id: "permissions",
      title: "Set Permissions",
      description: "Configure staff access level",
      schema: z.object({
        permissions: z.array(z.string()).min(1, "Select at least one permission"),
      }),
    },
    {
      id: "review",
      title: "Review & Send",
      description: "Confirm and send temporary access credentials",
      schema: z.object({
        confirmCreation: z
          .boolean()
          .refine((v) => v === true, "You must confirm to proceed"),
      }),
    },
  ],
};

/**
 * Admin configures platform-level MercadoPago environment variables.
 * Workflow: App OAuth → Payment Webhooks → Billing & Tokens → Review & Deploy
 */
export const configureMpEnvWorkflow: WorkflowDefinition = {
  id: "configure-mp-env",
  title: "Configurar Mercado Pago",
  description: "Configura las credenciales de MP, secretos de webhook y claves de facturación de la plataforma",
  requiredRole: "admin",
  steps: [
    {
      id: "mp-oauth",
      title: "App de pagos (Point)",
      description: "Client ID y Client Secret de la app de pagos presenciales en MP Developers",
      schema: z.object({
        MP_CLIENT_ID: z.string().min(1, "Client ID es requerido"),
        MP_CLIENT_SECRET: z.string().min(1, "Client Secret es requerido"),
      }),
    },
    {
      id: "mp-webhooks",
      title: "Webhook de pagos",
      description: "Clave secreta del webhook de la app de pagos (Point, Order, OAuth)",
      schema: z.object({
        MP_WEBHOOK_SECRET: z.string().min(1, "La clave secreta del webhook es requerida"),
      }),
    },
    {
      id: "mp-tokens",
      title: "App de facturación",
      description: "Webhook de la app de suscripciones y clave de cifrado de tokens OAuth",
      schema: z.object({
        MP_ACCESS_TOKEN: z.string().optional(),
        MP_BILLING_ACCESS_TOKEN: z.string().optional(),
        MP_BILLING_WEBHOOK_SECRET: z.string().optional(),
        MP_TOKENS_ENCRYPTION_KEY: z.string().optional(),
      }),
      optional: true,
    },
    {
      id: "mp-credentials",
      title: "Credenciales de tenant",
      description: "Vincula el MP user_id de producción con el tenant para que los webhooks resuelvan correctamente",
      schema: z.object({
        credentialsSaved: z.boolean().optional(),
      }),
      optional: true,
    },
    {
      id: "env-review",
      title: "Revisar y desplegar",
      description: "Copia el bloque .env generado en la configuración de tu hosting",
      schema: z.object({
        confirmed: z
          .boolean()
          .refine((v) => v === true, "Confirma que guardaste las variables"),
      }),
    },
  ],
};

export const configureMpBillingWorkflow: WorkflowDefinition = {
  id: "configure-mp-billing",
  title: "Activar suscripción de plataforma",
  description: "Crea plan y suscripción inicial para habilitar entitlements del tenant",
  requiredRole: "manager",
  steps: [
    {
      id: "billing-activation",
      title: "Configurar plan y suscripción",
      description: "Usa tu sesión de tenant y el email OAuth vinculado para crear la suscripción en MP Billing",
      schema: z.object({
        reason: z.string().min(3, "Reason es requerido"),
        transactionAmount: z.number().positive("Monto inválido"),
        currencyId: z.string().min(3, "Currency ID inválido"),
      }),
    },
    {
      id: "billing-review",
      title: "Revisar y activar",
      description: "Confirma los datos para crear plan + suscripción",
      schema: z.object({
        confirmed: z
          .boolean()
          .refine((v) => v === true, "Confirma para continuar"),
      }),
    },
  ],
};

/**
 * Get workflow definition by ID
 */
export function getWorkflowDefinition(
  workflowId: string
): WorkflowDefinition | null {
  const workflows: Record<string, WorkflowDefinition> = {
    "onboard-manager": onboardManagerWorkflow,
    "onboard-staff": onboardStaffWorkflow,
    "configure-mp-env": configureMpEnvWorkflow,
    "configure-mp-billing": configureMpBillingWorkflow,
  };
  return workflows[workflowId] || null;
}

/**
 * Get all available workflows (used for listing)
 */
export function getAllWorkflows(): WorkflowDefinition[] {
  return [
    onboardManagerWorkflow,
    onboardStaffWorkflow,
    configureMpEnvWorkflow,
    configureMpBillingWorkflow,
  ];
}

/**
 * Filter workflows by required role + current user role
 */
export function getAvailableWorkflows(userRole: string): WorkflowDefinition[] {
  const roleHierarchy: Record<string, string[]> = {
    admin: ["admin", "manager", "staff"],
    manager: ["manager", "staff"],
    staff: ["staff"],
  };

  const availableRoles = roleHierarchy[userRole] || [];
  return getAllWorkflows().filter((wf) =>
    availableRoles.includes(wf.requiredRole)
  );
}
