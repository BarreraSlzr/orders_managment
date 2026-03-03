import { verifySessionToken } from "@/lib/auth/session";
import { getMpPlatformConfig } from "@/lib/services/mercadopago/platformConfig";
import {
    getMpReport,
    type MpReportType,
} from "@/lib/services/mercadopago/reportsService";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const cookieName = process.env.AUTH_COOKIE_NAME || "__session";
    const sessionToken = request.cookies.get(cookieName)?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const session = await verifySessionToken(sessionToken);
    if (!session?.tenant_id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const type = request.nextUrl.searchParams.get("type") as MpReportType | null;
    const beginDate = request.nextUrl.searchParams.get("begin_date")?.trim() ?? "";
    const endDate = request.nextUrl.searchParams.get("end_date")?.trim() ?? "";

    if (!type || (type !== "settlement" && type !== "release")) {
      return NextResponse.json(
        { error: "type must be settlement or release" },
        { status: 400 },
      );
    }

    if (!beginDate || !endDate) {
      return NextResponse.json(
        { error: "begin_date and end_date are required" },
        { status: 400 },
      );
    }

    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "50");
    const offset = Number(request.nextUrl.searchParams.get("offset") ?? "0");

    const { paymentAccessToken } = await getMpPlatformConfig();
    if (!paymentAccessToken) {
      return NextResponse.json(
        { error: "Platform payment access token is not configured" },
        { status: 503 },
      );
    }

    const report = await getMpReport({
      accessToken: paymentAccessToken,
      type,
      beginDate,
      endDate,
      limit: Number.isFinite(limit) ? Math.max(1, Math.min(limit, 200)) : 50,
      offset: Number.isFinite(offset) ? Math.max(0, offset) : 0,
    });

    return NextResponse.json(report, { status: 200 });
  } catch (error) {
    console.error("[mp/reports]", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
