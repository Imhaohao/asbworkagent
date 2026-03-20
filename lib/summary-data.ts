import { rollupEvents, type EventRollup } from "./aggregate";
import { fiscalYearStart, fiscalYearLabel } from "./fiscal";
import { getSupabaseAdmin } from "./supabase/admin";

export type SummaryPayload = {
  fiscalYearCurrent: number;
  fiscalYearCurrentLabel: string;
  fiscalYearPrevious: number;
  fiscalYearPreviousLabel: string;
  rollupsCurrent: EventRollup[];
  rollupsPrevious: EventRollup[];
};

export async function loadSummary(
  accountCode: string | null,
): Promise<SummaryPayload> {
  const supabase = getSupabaseAdmin();
  let q = supabase
    .from("transactions")
    .select(
      "account_code, event_key, fiscal_year_start, amount, txn_type, description, notes",
    );

  if (accountCode) {
    q = q.eq("account_code", accountCode);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

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

  const filterFy = (fy: number) => rollups.filter((x) => x.fiscalYearStart === fy);

  return {
    fiscalYearCurrent: fyCurrent,
    fiscalYearCurrentLabel: fiscalYearLabel(fyCurrent),
    fiscalYearPrevious: fyPrevious,
    fiscalYearPreviousLabel: fiscalYearLabel(fyPrevious),
    rollupsCurrent: filterFy(fyCurrent),
    rollupsPrevious: filterFy(fyPrevious),
  };
}

export async function loadAccountList(): Promise<
  { account_code: string; account_name: string }[]
> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("transactions")
    .select("account_code, account_name")
    .order("account_code");

  if (error) throw new Error(error.message);

  const seen = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.account_code && !seen.has(row.account_code)) {
      seen.set(row.account_code, row.account_name ?? "");
    }
  }
  return [...seen.entries()].map(([account_code, account_name]) => ({
    account_code,
    account_name,
  }));
}
