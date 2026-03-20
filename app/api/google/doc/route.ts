import { NextRequest, NextResponse } from "next/server";
import { rollupEvents } from "@/lib/aggregate";
import {
  fiscalYearLabel,
  quarterDateRange,
  quarterLabel,
} from "@/lib/fiscal";
import {
  assertImportAuthorized,
  importUnauthorizedResponse,
} from "@/lib/import-secret";
import { createTextDoc } from "@/lib/google-server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    assertImportAuthorized(req);
  } catch {
    return importUnauthorizedResponse();
  }

  let body: {
    fiscalYearStart?: number;
    quarter?: number;
    accountCode?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  }

  const q = body.quarter;
  const fy = body.fiscalYearStart;
  if (q == null || fy == null || q < 1 || q > 4) {
    return NextResponse.json(
      { error: "Provide fiscalYearStart (e.g. 2024) and quarter (1–4)" },
      { status: 400 },
    );
  }

  const quarter = q as 1 | 2 | 3 | 4;
  const { start, end } = quarterDateRange(fy, quarter);

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("transactions")
    .select(
      "account_code, event_key, fiscal_year_start, amount, txn_type, description, notes, txn_date",
    )
    .gte("txn_date", start.toISOString().slice(0, 10))
    .lte("txn_date", end.toISOString().slice(0, 10));

  if (body.accountCode) {
    query = query.eq("account_code", body.accountCode);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rollups = rollupEvents(
    (data ?? []).map((r) => ({
      accountCode: r.account_code,
      eventKey: r.event_key,
      fiscalYearStart: r.fiscal_year_start,
      amount: Number(r.amount),
      txnType: r.txn_type,
      description: r.description ?? "",
      notes: r.notes ?? "",
    })),
  );

  const title = `ASB Quarterly — ${fiscalYearLabel(fy)} ${quarterLabel(fy, quarter)}`;
  const money = (n: number) => n.toFixed(2);

  const lines: string[] = [
    title,
    `Period: ${start.toLocaleDateString()} – ${end.toLocaleDateString()}`,
    "",
    "Event-level summary (from imported ASBWORKS statement data)",
    "",
  ];

  for (const r of rollups) {
    lines.push(`Account ${r.accountCode} — ${r.eventKey}`);
    lines.push(
      `  Net ${money(r.net)} | In ${money(r.inflow)} | Out ${money(r.outflow)} | Txns ${r.txnCount} | Receipts ${r.receiptCount} | Scholarship net ${money(r.scholarshipNet)} | Ticket-like ${r.ticketLikeCount}`,
    );
    lines.push("");
  }

  const url = await createTextDoc(title, lines.join("\n"));

  return NextResponse.json({
    ok: true,
    docUrl: url,
    eventCount: rollups.length,
  });
}
