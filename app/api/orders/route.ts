import { getOrders } from "@/lib/sql/functions/getOrders";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const timeZone = url.searchParams.get("timeZone") || "America/Mexico_City";
    const date = url.searchParams.get("date") || undefined;
    const isClosed = url.searchParams.has("isClosed")
      ? url.searchParams.get("isClosed") === "true"
      : undefined;
    const getAll = url.searchParams.has("all")
      ? url.searchParams.get("all") === "true"
      : false;

    const orders = await getOrders({ timeZone, date, isClosed, all: getAll});
    return NextResponse.json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
