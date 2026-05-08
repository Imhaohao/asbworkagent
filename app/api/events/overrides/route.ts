import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type EventOverride = {
  id: string;
  account_code: string;
  event_key: string;
  fiscal_year_start: number;
  display_name: string | null;
  description: string | null;
  projected_revenue: number | null;
  projected_expenses: number | null;
  group_name: string | null;
};

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const fy = req.nextUrl.searchParams.get("fy");
  const acct = req.nextUrl.searchParams.get("accountCode");

  let q = supabase.from("event_overrides").select("*");
  if (fy) q = q.eq("fiscal_year_start", Number(fy));
  if (acct) q = q.eq("account_code", acct);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ overrides: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const body = await req.json();

  const { account_code, event_key, fiscal_year_start, display_name, description, projected_revenue, projected_expenses, group_name } = body;

  // Batch merge: array of events to assign the same group_name
  if (Array.isArray(body.events)) {
    const fy = body.fiscal_year_start;
    const gn = body.group_name as string | null;
    if (fy == null) {
      return NextResponse.json({ error: "fiscal_year_start is required" }, { status: 400 });
    }
    const rows = (body.events as { account_code: string; event_key: string }[]).map((e) => ({
      account_code: e.account_code,
      event_key: e.event_key,
      fiscal_year_start: fy,
      group_name: gn ?? null,
      updated_at: new Date().toISOString(),
    }));
    const { error: batchErr } = await supabase
      .from("event_overrides")
      .upsert(rows, { onConflict: "account_code,event_key,fiscal_year_start" });
    if (batchErr) {
      return NextResponse.json({ error: batchErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, merged: rows.length });
  }

  if (!account_code || !event_key || fiscal_year_start == null) {
    return NextResponse.json(
      { error: "account_code, event_key, and fiscal_year_start are required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("event_overrides")
    .upsert(
      {
        account_code,
        event_key,
        fiscal_year_start,
        display_name: display_name ?? null,
        description: description ?? null,
        projected_revenue: projected_revenue ?? null,
        projected_expenses: projected_expenses ?? null,
        group_name: group_name ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "account_code,event_key,fiscal_year_start" },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ override: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await supabase.from("event_overrides").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
