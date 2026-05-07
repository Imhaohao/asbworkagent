import { rollupEvents, type EventRollup } from "./aggregate";
import {
  chartFiscalYearPair,
  fiscalYearStart,
  fiscalYearLabel,
} from "./fiscal";
import { getSupabaseAdmin } from "./supabase/admin";

const PAGE_SIZE = 1000;

async function fetchAll<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await buildQuery(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

export type SummaryPayload = {
  /** Calendar “current” FY from today (for chart footnote vs wall-clock year). */
  fiscalYearCurrent: number;
  fiscalYearCurrentLabel: string;
  fiscalYearPrevious: number;
  fiscalYearPreviousLabel: string;
  /** FY labels for the rows shown in rollup tables / overview (same pair as charts). */
  dataFyCurrentLabel: string;
  dataFyPreviousLabel: string;
  rollupsCurrent: EventRollup[];
  rollupsPrevious: EventRollup[];
  /** Same arrays as rollupsCurrent / rollupsPrevious (kept for callers that expect chart keys). */
  chartRollupsCurrent: EventRollup[];
  chartRollupsPrevious: EventRollup[];
  chartFyCurrentLabel: string;
  chartFyPreviousLabel: string;
  chartsUsedAdaptiveYears: boolean;
};

export async function loadSummary(
  accountCode: string | null,
): Promise<SummaryPayload> {
  const supabase = getSupabaseAdmin();
  const data = await fetchAll((from, to) => {
    let q = supabase
      .from("transactions")
      .select(
        "account_code, event_key, fiscal_year_start, amount, txn_type, description, notes",
      )
      .range(from, to);
    if (accountCode) q = q.eq("account_code", accountCode);
    return q;
  });

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

  const { curr: chartCurr, prev: chartPrev, usedAdaptiveYears } =
    chartFiscalYearPair(rollups, fyCurrent, fyPrevious);

  const rollupsCurrent = filterFy(chartCurr);
  const rollupsPrevious = filterFy(chartPrev);

  return {
    fiscalYearCurrent: fyCurrent,
    fiscalYearCurrentLabel: fiscalYearLabel(fyCurrent),
    fiscalYearPrevious: fyPrevious,
    fiscalYearPreviousLabel: fiscalYearLabel(fyPrevious),
    dataFyCurrentLabel: fiscalYearLabel(chartCurr),
    dataFyPreviousLabel: fiscalYearLabel(chartPrev),
    rollupsCurrent,
    rollupsPrevious,
    chartRollupsCurrent: rollupsCurrent,
    chartRollupsPrevious: rollupsPrevious,
    chartFyCurrentLabel: fiscalYearLabel(chartCurr),
    chartFyPreviousLabel: fiscalYearLabel(chartPrev),
    chartsUsedAdaptiveYears: usedAdaptiveYears,
  };
}

export async function loadAccountList(): Promise<
  { account_code: string; account_name: string }[]
> {
  const supabase = getSupabaseAdmin();
  const [txRows, impRows] = await Promise.all([
    fetchAll((from, to) =>
      supabase.from("transactions").select("account_code, account_name").range(from, to),
    ),
    fetchAll((from, to) =>
      supabase.from("imports").select("account_code, account_name").range(from, to),
    ),
  ]);

  const seen = new Map<string, string>();
  for (const row of impRows) {
    if (row.account_code && !seen.has(row.account_code)) {
      seen.set(row.account_code, (row.account_name ?? "").trim());
    }
  }
  for (const row of txRows) {
    if (!row.account_code) continue;
    const n = (row.account_name ?? "").trim();
    if (n) seen.set(row.account_code, n);
    else if (!seen.has(row.account_code))
      seen.set(row.account_code, (row.account_name ?? "").trim());
  }
  return [...seen.entries()]
    .map(([account_code, account_name]) => ({
      account_code,
      account_name,
    }))
    .sort((a, b) => a.account_code.localeCompare(b.account_code));
}

/** Latest `imports.created_at` (successful upload), or null if none. */
export async function loadLastImportAt(
  accountCode: string | null,
): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  let q = supabase
    .from("imports")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1);
  if (accountCode) {
    q = q.eq("account_code", accountCode);
  }
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as { created_at: string } | null;
  return row?.created_at ?? null;
}
