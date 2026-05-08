"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo } from "react";
import type { EventRollup } from "@/lib/aggregate";
import { groupRollups, type GroupedCategory } from "@/lib/event-groups";

const FiscalCharts = dynamic(() => import("../fiscal-charts"), {
  ssr: false,
  loading: () => (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex h-72 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
        Loading charts…
      </div>
      <div className="flex h-72 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
        Loading charts…
      </div>
    </div>
  ),
});

type Account = { account_code: string; account_name: string };

function formatMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function AccountNav({ accounts }: { accounts: Account[] }) {
  return (
    <nav className="mb-8 flex flex-wrap gap-2 border-b border-zinc-200 pb-4 dark:border-zinc-800" aria-label="Accounts">
      <Link
        href="/public"
        className="rounded-lg px-3 py-2 text-sm font-medium bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Overview
      </Link>
      {accounts.map((a) => {
        const label = a.account_name?.trim()
          ? `${a.account_name} (${a.account_code})`
          : a.account_code;
        return (
          <Link
            key={a.account_code}
            href={`/public?account=${encodeURIComponent(a.account_code)}`}
            className="rounded-lg px-3 py-2 text-sm font-medium bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-200 dark:ring-zinc-700 dark:hover:bg-zinc-900"
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function PublicGroupCard({ group: g, fyPreviousLabel }: { group: GroupedCategory; fyPreviousLabel: string }) {
  const isGrouped = g.subEvents.length > 1;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
          {g.group}
        </div>
        {isGrouped && (
          <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {g.subEvents.length} events
          </span>
        )}
      </div>
      <div className="mt-2">
        <span className="text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
          {formatMoney(g.currentInflow)}
        </span>
        <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-400">revenue</span>
      </div>
      <div className="mt-1">
        <span className="text-lg font-semibold tabular-nums text-rose-700 dark:text-rose-400">
          {formatMoney(g.currentOutflow)}
        </span>
        <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-400">expenses</span>
      </div>
      <div className="mt-1 text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
        {formatMoney(g.currentNet)}
        <span className="ml-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">net</span>
      </div>
      {(g.previousInflow > 0 || g.previousOutflow > 0) && (
        <div className="mt-1.5 border-t border-zinc-100 pt-1.5 text-xs tabular-nums text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          {fyPreviousLabel}: {formatMoney(g.previousInflow)} in / {formatMoney(g.previousOutflow)} out
        </div>
      )}
      <div className="mt-1 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
        {g.currentTxns} txns
      </div>
    </div>
  );
}

export default function PublicDashboard(props: {
  accounts: Account[];
  rollupsCurrent: EventRollup[];
  rollupsPrevious: EventRollup[];
  chartRollupsCurrent: EventRollup[];
  chartRollupsPrevious: EventRollup[];
  chartFyCurrentLabel: string;
  chartFyPreviousLabel: string;
  chartsUsedAdaptiveYears: boolean;
  fyCurrentLabel: string;
  fyPreviousLabel: string;
  dataFyCurrentLabel: string;
  dataFyPreviousLabel: string;
}) {
  const groups = useMemo(
    () => groupRollups(props.rollupsCurrent, props.rollupsPrevious),
    [props.rollupsCurrent, props.rollupsPrevious],
  );

  return (
    <div className="space-y-8">
      <AccountNav accounts={props.accounts} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Cost comparison &amp; inflow cushion
        </h2>
        <FiscalCharts
          rollupsCurrent={props.chartRollupsCurrent}
          rollupsPrevious={props.chartRollupsPrevious}
          fyCurrentLabel={props.chartFyCurrentLabel}
          fyPreviousLabel={props.chartFyPreviousLabel}
          chartsUsedAdaptiveYears={props.chartsUsedAdaptiveYears}
          calendarFyCurrentLabel={props.fyCurrentLabel}
          calendarFyPreviousLabel={props.fyPreviousLabel}
        />
      </section>

      {groups.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            By event ({props.dataFyCurrentLabel})
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Event-level breakdown with year-over-year comparison. Related events are combined.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <PublicGroupCard
                key={g.group}
                group={g}
                fyPreviousLabel={props.dataFyPreviousLabel}
              />
            ))}
          </div>
        </section>
      )}

      <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
        Data sourced from ASBWORKS. For questions, contact the{" "}
        <a
          href="mailto:jerryyan745@gmail.com?subject=ASB%20Financial%20Inquiry"
          className="underline hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          ASB Treasurer
        </a>.
      </p>
    </div>
  );
}
