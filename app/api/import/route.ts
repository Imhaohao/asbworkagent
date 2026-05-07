import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { parseAccountStatementHtml } from "@/lib/asb-parser";
import {
  assertImportAuthorized,
  importUnauthorizedResponse,
} from "@/lib/import-secret";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    assertImportAuthorized(req);
  } catch {
    return importUnauthorizedResponse();
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing "file" field' }, { status: 400 });
  }

  const text = await file.text();
  const { meta, rows } = parseAccountStatementHtml(text, file.name);

  const supabase = getSupabaseAdmin();

  const { data: imp, error: impErr } = await supabase
    .from("imports")
    .insert({
      filename: file.name,
      account_name: meta.accountName,
      account_code: meta.accountCode,
      row_count: rows.length,
    })
    .select("id")
    .single();

  if (impErr || !imp) {
    return NextResponse.json(
      { error: impErr?.message ?? "Import metadata insert failed" },
      { status: 500 },
    );
  }

  const dbRows = rows.map((r) => ({
    import_id: imp.id,
    account_code: meta.accountCode,
    account_name: meta.accountName,
    txn_date: r.txnDate.toISOString().slice(0, 10),
    ref_number: r.refNumber,
    txn_type: r.txnType,
    description: r.description,
    payee_name: r.payeeName,
    notes: r.notes,
    amount: r.amount,
    balance: r.balance,
    event_key: r.eventKey,
    fiscal_year_start: r.fiscalYearStart,
    content_hash: r.contentHash,
  }));

  const chunkSize = 400;
  for (let i = 0; i < dbRows.length; i += chunkSize) {
    const slice = dbRows.slice(i, i + chunkSize);
    const { error: txErr } = await supabase.from("transactions").upsert(slice, {
      onConflict: "content_hash",
      ignoreDuplicates: true,
    });
    if (txErr) {
      return NextResponse.json(
        {
          error: txErr.message,
          hint:
            slice.length > 0
              ? `Upsert failed on rows ${i + 1}–${i + slice.length} of ${dbRows.length}. Check Supabase row/size limits and constraints.`
              : undefined,
        },
        { status: 500 },
      );
    }
  }

  revalidatePath("/", "layout");

  return NextResponse.json({
    ok: true,
    account: meta,
    parsedRows: rows.length,
  });
}
