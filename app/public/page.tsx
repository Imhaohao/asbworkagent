import Link from "next/link";
import { loadAccountList, loadSummary } from "@/lib/summary-data";
import PublicDashboard from "./public-dashboard";

export const dynamic = "force-dynamic";

export default async function PublicPage() {
  let accounts: Awaited<ReturnType<typeof loadAccountList>> = [];
  let summary: Awaited<ReturnType<typeof loadSummary>> | null = null;
  let error: string | null = null;

  try {
    [accounts, summary] = await Promise.all([
      loadAccountList(),
      loadSummary(null),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load data";
  }

  if (error || !summary) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-4 py-10">
        <p className="text-red-600">{error ?? "Unknown error"}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-10">
      <header className="mb-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Paly ASB Balance Sheet
            </h1>
            <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
              Public view of ASB event financials. For full access,{" "}
              <Link href="/login" className="underline hover:text-zinc-900 dark:hover:text-zinc-100">
                sign in
              </Link>.
            </p>
          </div>
          <a
            href="mailto:jerryyan745@gmail.com?subject=ASB%20Financial%20Inquiry"
            className="shrink-0 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Contact Treasurer
          </a>
        </div>
      </header>
      <PublicDashboard
        accounts={accounts}
        rollupsCurrent={summary.rollupsCurrent}
        rollupsPrevious={summary.rollupsPrevious}
        chartRollupsCurrent={summary.chartRollupsCurrent}
        chartRollupsPrevious={summary.chartRollupsPrevious}
        chartFyCurrentLabel={summary.chartFyCurrentLabel}
        chartFyPreviousLabel={summary.chartFyPreviousLabel}
        chartsUsedAdaptiveYears={summary.chartsUsedAdaptiveYears}
        fyCurrentLabel={summary.fiscalYearCurrentLabel}
        fyPreviousLabel={summary.fiscalYearPreviousLabel}
        dataFyCurrentLabel={summary.dataFyCurrentLabel}
        dataFyPreviousLabel={summary.dataFyPreviousLabel}
      />
    </main>
  );
}
