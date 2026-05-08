import { cookies } from "next/headers";
import DashboardClient from "./dashboard-client";
import DashboardSetupError from "./dashboard-setup-error";
import {
  loadAccountList,
  loadLastImportAt,
  loadSummary,
} from "@/lib/summary-data";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const cookieStore = await cookies();
  const role = (cookieStore.get("access_role")?.value ?? "admin") as "admin" | "journalist";
  const sp = await searchParams;
  const legacy = sp.account?.trim();
  if (legacy) {
    redirect(`/account/${encodeURIComponent(legacy)}`);
  }

  let accounts: Awaited<ReturnType<typeof loadAccountList>> = [];
  let summary: Awaited<ReturnType<typeof loadSummary>> | null = null;
  let lastImportAt: string | null = null;
  let setupError: string | null = null;

  try {
    [accounts, summary, lastImportAt] = await Promise.all([
      loadAccountList(),
      loadSummary(null),
      loadLastImportAt(null),
    ]);
  } catch (e) {
    setupError = e instanceof Error ? e.message : "Could not load data";
  }

  if (setupError || !summary) {
    return <DashboardSetupError message={setupError ?? "Unknown error"} />;
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-10">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Overview
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
          All imported accounts combined. Import Account Statement exports from
          ASBWORKS (HTML .xls), then drill into General, Dance, Spirit, or
          another account from the tabs below. Sync rollups to Google Sheets or
          generate a fiscal quarter report as a Google Doc.
        </p>
      </header>
      <DashboardClient
        accounts={accounts}
        scopeMode="overview"
        scopeAccountCode={null}
        lastImportAtIso={lastImportAt}
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
        role={role}
      />
    </main>
  );
}
