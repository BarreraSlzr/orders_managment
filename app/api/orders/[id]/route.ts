import { getOrderItemsView } from "@/lib/sql/functions/getOrderItemsView";
import { NextResponse } from "next/server";


export async function GET(request: Request, { params }: {params: Promise<{id: string}>}) {
  try {
    const id = (await params).id
    const order = await getOrderItemsView(id);
    return NextResponse.json(order);
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}
