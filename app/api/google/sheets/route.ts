import { NextRequest, NextResponse } from "next/server";
import { rollupEvents } from "@/lib/aggregate";
import { fiscalYearStart } from "@/lib/fiscal";
import {
  assertImportAuthorized,
  importUnauthorizedResponse,
} from "@/lib/import-secret";
import { syncFormattedSummarySheet } from "@/lib/google-summary-sheet-sync";
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

  try {
    const { updatedRange, rowCount } = await syncFormattedSummarySheet({
      spreadsheetId,
      targetRangeEnv: range,
      rollups: picked,
      fyCurrent: fyCurrent,
      fyPrevious: fyPrevious,
    });

    return NextResponse.json({
      ok: true,
      updatedRange,
      rowCount,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Google Sheets request failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
