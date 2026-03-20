import { NextRequest, NextResponse } from "next/server";
import { loadSummary } from "@/lib/summary-data";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accountFilter = searchParams.get("accountCode");

  try {
    const payload = await loadSummary(accountFilter);
    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
