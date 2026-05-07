import { NextResponse } from "next/server";
import { loadAccountList } from "@/lib/summary-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const accounts = await loadAccountList();
    return NextResponse.json({ accounts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg, accounts: [] }, { status: 200 });
  }
}
