import { mpFetch } from "@/lib/services/mercadopago/mpFetch";

// ─── Subscription Details (read from MP API) ─────────────────────────────────

export interface MpSubscriptionDetails {
  id: string;
  status: string;
  external_reference?: string;
  payer_email?: string;
  reason?: string;
  date_created?: string;
  last_modified?: string;
  auto_recurring?: {
    frequency?: number;
    frequency_type?: string;
    transaction_amount?: number;
    currency_id?: string;
  };
  next_payment_date?: string;
}

/**
 * Fetches full subscription (preapproval) details from the MP API.
 * Used by the billing webhook translator to resolve `external_reference`
 * (our tenantId) and map the remote status.
 */
export async function fetchSubscriptionDetails(params: {
  accessToken: string;
  subscriptionId: string;
}): Promise<MpSubscriptionDetails> {
  return mpFetch<MpSubscriptionDetails>({
    accessToken: params.accessToken,
    method: "GET",
    path: `/preapproval/${params.subscriptionId}`,
  });
}

// ─── Create plan + subscription ──────────────────────────────────────────────

export interface CreatePreapprovalPlanParams {
  accessToken: string;
  reason: string;
  transactionAmount: number;
  currencyId: string;
  backUrl: string;
  frequency?: number;
  frequencyType?: "days" | "months";
}

export interface CreatePreapprovalPlanResult {
  id: string;
  reason?: string;
  back_url?: string;
  auto_recurring?: {
    frequency?: number;
    frequency_type?: string;
    transaction_amount?: number;
    currency_id?: string;
  };
}

export interface CreateSubscriptionParams {
  accessToken: string;
  preapprovalPlanId: string;
  payerEmail: string;
  externalReference: string;
  backUrl: string;
  reason: string;
}

export interface CreateSubscriptionResult {
  id: string;
  status: string;
  init_point?: string;
  external_reference?: string;
}

export async function createPreapprovalPlan(
  params: CreatePreapprovalPlanParams,
): Promise<CreatePreapprovalPlanResult> {
  return mpFetch<CreatePreapprovalPlanResult>({
    accessToken: params.accessToken,
    method: "POST",
    path: "/preapproval_plan",
    body: {
      reason: params.reason,
      auto_recurring: {
        frequency: params.frequency ?? 1,
        frequency_type: params.frequencyType ?? "months",
        transaction_amount: params.transactionAmount,
        currency_id: params.currencyId,
      },
      back_url: params.backUrl,
    },
  });
}

export async function createSubscription(
  params: CreateSubscriptionParams,
): Promise<CreateSubscriptionResult> {
  return mpFetch<CreateSubscriptionResult>({
    accessToken: params.accessToken,
    method: "POST",
    path: "/preapproval",
    body: {
      preapproval_plan_id: params.preapprovalPlanId,
      payer_email: params.payerEmail,
      external_reference: params.externalReference,
      back_url: params.backUrl,
      reason: params.reason,
    },
  });
}