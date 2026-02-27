import { mpFetch } from "@/lib/services/mercadopago/mpFetch";

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