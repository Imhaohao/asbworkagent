import { NextRequest, NextResponse } from "next/server";
import { rollupEvents } from "@/lib/aggregate";
import { quarterDateRange } from "@/lib/fiscal";
import {
  assertImportAuthorized,
  importUnauthorizedResponse,
} from "@/lib/import-secret";
import { createTextDoc } from "@/lib/google-server";
import { quarterReportToDocxBuffer } from "@/lib/quarter-report-docx";
import { quarterReportToPdfBuffer } from "@/lib/quarter-report-pdf";
import { quarterReportDownloadBasename } from "@/lib/quarter-report-filename";
import {
  buildQuarterReportModel,
  quarterReportModelToPlainText,
} from "@/lib/quarter-report";
import { loadAccountList } from "@/lib/summary-data";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    assertImportAuthorized(req);
  } catch {
    return importUnauthorizedResponse();
  }

  let payload: {
    fiscalYearStart?: number;
    quarter?: number;
    accountCode?: string | null;
    format?: string | null;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  }

  const q = payload.quarter;
  const fy = payload.fiscalYearStart;
  if (q == null || fy == null || q < 1 || q > 4) {
    return NextResponse.json(
      { error: "Provide fiscalYearStart (e.g. 2024) and quarter (1–4)" },
      { status: 400 },
    );
  }

  const fmtRaw = (payload.format ?? "gdoc").toLowerCase().trim();
  const format =
    fmtRaw === "docx" || fmtRaw === "pdf" || fmtRaw === "gdoc"
      ? fmtRaw
      : null;
  if (!format) {
    return NextResponse.json(
      { error: 'format must be "gdoc", "docx", or "pdf"' },
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

  if (payload.accountCode) {
    query = query.eq("account_code", payload.accountCode);
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

  let accounts: { account_code: string; account_name: string }[];
  try {
    accounts = await loadAccountList();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load account list";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const model = buildQuarterReportModel({
    fiscalYearStart: fy,
    quarter,
    periodStart: start,
    periodEnd: end,
    rollups,
    accounts,
    singleAccountCode: payload.accountCode ?? null,
  });

  const baseName = quarterReportDownloadBasename(model.docTitle);

  if (format === "docx") {
    let buf: Buffer;
    try {
      buf = await quarterReportToDocxBuffer(model);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "DOCX build failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${baseName}.docx"`,
      },
    });
  }

  if (format === "pdf") {
    let buf: Buffer;
    try {
      buf = quarterReportToPdfBuffer(model);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "PDF build failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
      },
    });
  }

  const docBody = quarterReportModelToPlainText(model);
  let url: string;
  try {
    url = await createTextDoc(model.docTitle, docBody);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Google Docs request failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    docUrl: url,
    eventCount: rollups.length,
  });
}
