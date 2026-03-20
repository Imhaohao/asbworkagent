import DashboardClient from "./dashboard-client";
import { loadAccountList, loadSummary } from "@/lib/summary-data";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const sp = await searchParams;
  const selectedAccount = sp.account?.trim() ?? "";

  let accounts: Awaited<ReturnType<typeof loadAccountList>> = [];
  let summary: Awaited<ReturnType<typeof loadSummary>> | null = null;
  let setupError: string | null = null;

  try {
    accounts = await loadAccountList();
    summary = await loadSummary(selectedAccount || null);
  } catch (e) {
    setupError = e instanceof Error ? e.message : "Could not load data";
  }

  if (setupError || !summary) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-4 py-16">
        <h1 className="mb-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          ASB dashboard
        </h1>
        <p className="mb-4 text-zinc-600 dark:text-zinc-400">
          Add Supabase credentials to <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">.env.local</code> and run the SQL migration in{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">supabase/migrations/001_initial.sql</code>.
        </p>
        <pre className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-red-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-red-400">
          {setupError}
        </pre>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-10">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          ASB accounts
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
          Import Account Statement exports from ASBWORKS (HTML .xls), then review
          inflows, outflows, and scholarship activity by event tag. Sync rollups to
          Google Sheets or generate a fiscal quarter report as a Google Doc.
        </p>
      </header>
      <DashboardClient
        accounts={accounts}
        selectedAccount={selectedAccount}
        rollupsCurrent={summary.rollupsCurrent}
        rollupsPrevious={summary.rollupsPrevious}
        fyCurrentLabel={summary.fiscalYearCurrentLabel}
        fyPreviousLabel={summary.fiscalYearPreviousLabel}
      />
    </main>
  );
}
