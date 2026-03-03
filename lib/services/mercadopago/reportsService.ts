import { mpFetch } from "@/lib/services/mercadopago/mpFetch";

export type MpReportType = "settlement" | "release";

export interface GetMpReportParams {
  accessToken: string;
  type: MpReportType;
  beginDate: string;
  endDate: string;
  limit?: number;
  offset?: number;
}

export interface MpReportResult {
  id?: string;
  status?: string;
  file_name?: string;
  created_at?: string;
  data?: unknown;
  results?: unknown[];
  paging?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
}

function getReportPath(type: MpReportType): string {
  if (type === "settlement") return "/v1/account/settlement_report/search";
  return "/v1/account/release_report/search";
}

/**
 * Fetches Mercado Pago settlement/release report data for a date window.
 */
export async function getMpReport(
  params: GetMpReportParams,
): Promise<MpReportResult> {
  const query = new URLSearchParams({
    begin_date: params.beginDate,
    end_date: params.endDate,
    limit: String(params.limit ?? 50),
    offset: String(params.offset ?? 0),
  });

  return mpFetch<MpReportResult>({
    accessToken: params.accessToken,
    method: "GET",
    path: `${getReportPath(params.type)}?${query.toString()}`,
  });
}
