import { cookies } from "next/headers";
import DashboardClient from "@/app/dashboard-client";
import DashboardSetupError from "@/app/dashboard-setup-error";
import {
  loadAccountList,
  loadLastImportAt,
  loadSummary,
} from "@/lib/summary-data";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const cookieStore = await cookies();
  const role = (cookieStore.get("access_role")?.value ?? "admin") as "admin" | "journalist";
  const { code: raw } = await params;
  const accountCode = decodeURIComponent(raw);

  let accounts: Awaited<ReturnType<typeof loadAccountList>> = [];
  let summary: Awaited<ReturnType<typeof loadSummary>> | null = null;
  let lastImportAt: string | null = null;
  let setupError: string | null = null;

  try {
    accounts = await loadAccountList();
  } catch (e) {
    setupError = e instanceof Error ? e.message : "Could not load data";
  }

  if (setupError) {
    return <DashboardSetupError message={setupError} />;
  }

  const valid = accounts.some((a) => a.account_code === accountCode);
  if (!valid) {
    notFound();
  }

  try {
    [summary, lastImportAt] = await Promise.all([
      loadSummary(accountCode),
      loadLastImportAt(accountCode),
    ]);
  } catch (e) {
    setupError = e instanceof Error ? e.message : "Could not load data";
  }

  if (setupError || !summary) {
    return <DashboardSetupError message={setupError ?? "Unknown error"} />;
  }

  const accountMeta = accounts.find((a) => a.account_code === accountCode)!;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-10">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {accountMeta.account_name || accountCode}
        </h1>
        <p className="mt-1 font-mono text-sm text-zinc-500 dark:text-zinc-400">
          {accountCode}
        </p>
        <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
          Event-level rollups for this account. Use Overview for all accounts
          combined.
        </p>
      </header>
      <DashboardClient
        accounts={accounts}
        scopeMode="account"
        scopeAccountCode={accountCode}
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
