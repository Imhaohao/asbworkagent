import { NextRequest, NextResponse } from "next/server";
import { rollupEvents } from "@/lib/aggregate";
import { fiscalYearStart, fiscalYearLabel } from "@/lib/fiscal";
import {
  assertImportAuthorized,
  importUnauthorizedResponse,
} from "@/lib/import-secret";
import { writeSheetRange } from "@/lib/google-server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    assertImportAuthorized(req);
  } catch {
    return importUnauthorizedResponse();
  }

  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const range = process.env.GOOGLE_SHEETS_RANGE ?? "Summary!A1";

  if (!spreadsheetId) {
    return NextResponse.json(
      { error: "Set GOOGLE_SPREADSHEET_ID" },
      { status: 500 },
    );
  }

  let body: { accountCode?: string | null } = {};
  try {
    body = await req.json();
  } catch {
    /* optional body */
  }

  const supabase = getSupabaseAdmin();
  let q = supabase
    .from("transactions")
    .select(
      "account_code, event_key, fiscal_year_start, amount, txn_type, description, notes",
    );

  if (body.accountCode) {
    q = q.eq("account_code", body.accountCode);
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const fyCurrent = fiscalYearStart(new Date());
  const fyPrevious = fyCurrent - 1;

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

  const picked = rollups.filter(
    (r) =>
      r.fiscalYearStart === fyCurrent || r.fiscalYearStart === fyPrevious,
  );

  const money = (n: number) => n.toFixed(2);

  const headers = [
    "Account",
    "Event / tag",
    "Fiscal year",
    "Inflow",
    "Outflow",
    "Net",
    "Transactions",
    "Receipt lines",
    "Scholarship (net)",
    "Ticket-like receipts",
  ];

  const rows: string[][] = [
    headers,
    ...picked.map((r) => [
      r.accountCode,
      r.eventKey,
      fiscalYearLabel(r.fiscalYearStart),
      money(r.inflow),
      money(r.outflow),
      money(r.net),
      String(r.txnCount),
      String(r.receiptCount),
      money(r.scholarshipNet),
      String(r.ticketLikeCount),
    ]),
  ];

  await writeSheetRange(spreadsheetId, range, rows);

  return NextResponse.json({
    ok: true,
    updatedRange: range,
    rowCount: rows.length,
  });
}
