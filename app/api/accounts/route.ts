import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("transactions")
      .select("account_code, account_name")
      .order("account_code");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const seen = new Map<string, string>();
    for (const row of data ?? []) {
      if (row.account_code && !seen.has(row.account_code)) {
        seen.set(row.account_code, row.account_name ?? "");
      }
    }

    const accounts = [...seen.entries()].map(([account_code, account_name]) => ({
      account_code,
      account_name,
    }));

    return NextResponse.json({ accounts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg, accounts: [] }, { status: 200 });
  }
}
