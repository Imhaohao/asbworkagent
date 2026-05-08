"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EventRollup } from "@/lib/aggregate";
import { groupRollups, type GroupedCategory, type ManualGroupEntry } from "@/lib/event-groups";
import { sortAccountsForNav } from "@/lib/account-nav-order";

type EventOverride = {
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

/** Recharts must not load on the server — avoids missing `vendor-chunks/recharts.js` in dev. */
const FiscalCharts = dynamic(() => import("./fiscal-charts"), {
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
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function OverviewAccountTotals({
  rows,
  accounts,
  dataFyLabel,
}: {
  rows: EventRollup[];
  accounts: Account[];
  dataFyLabel: string;
}) {
  const nameByCode = useMemo(
    () => new Map(accounts.map((a) => [a.account_code, a.account_name])),
    [accounts],
  );

  const byAcct = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      m.set(r.accountCode, (m.get(r.accountCode) ?? 0) + r.net);
    }
    return [...m.entries()]
      .map(([code, net]) => ({
        code,
        net,
        label: nameByCode.get(code)?.trim() || code,
      }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [rows, nameByCode]);

  if (byAcct.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No net activity for {dataFyLabel} in this view (import a statement or pick another account).
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {byAcct.map((a) => (
        <Link
          key={a.code}
          href={`/account/${encodeURIComponent(a.code)}`}
          className="rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
        >
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {a.label}
          </div>
          <div className="mt-0.5 font-mono text-xs text-zinc-500 dark:text-zinc-400">
            {a.code}
          </div>
          <div className="mt-2 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {formatMoney(a.net)}
            <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
              net
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function LastUpdatedSection({
  iso,
  scopeMode,
}: {
  iso: string | null;
  scopeMode: "overview" | "account";
}) {
  const scopePhrase =
    scopeMode === "overview" ? "any account" : "this account";

  return (
    <section
      className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
      aria-labelledby="last-updated-heading"
    >
      <h2
        id="last-updated-heading"
        className="text-sm font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400"
      >
        Last updated
      </h2>
      <p className="mt-1 text-base font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
        {iso
          ? new Date(iso).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : `No import recorded yet for ${scopePhrase}.`}
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Shown in your local time zone. Updates when you upload a new ASBWORKS
        export.
      </p>
    </section>
  );
}

function AccountNav({ accounts }: { accounts: Account[] }) {
  const pathname = usePathname();
  const ordered = useMemo(() => sortAccountsForNav(accounts), [accounts]);

  const linkCls = (active: boolean) =>
    [
      "rounded-lg px-3 py-2 text-sm font-medium transition",
      active
        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
        : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-200 dark:ring-zinc-700 dark:hover:bg-zinc-900",
    ].join(" ");

  return (
    <nav
      className="mb-8 flex flex-wrap items-center gap-2 border-b border-zinc-200 pb-4 dark:border-zinc-800"
      aria-label="Accounts"
    >
      <Link href="/" className={linkCls(pathname === "/")}>
        Overview
      </Link>
      {ordered.map((a) => {
        const href = `/account/${encodeURIComponent(a.account_code)}`;
        const active = pathname === href;
        const label = a.account_name?.trim()
          ? `${a.account_name} (${a.account_code})`
          : a.account_code;
        return (
          <Link key={a.account_code} href={href} className={linkCls(active)}>
            {label}
          </Link>
        );
      })}
      <div className="ml-auto">
        <a
          href="mailto:jerryyan745@gmail.com?subject=ASB%20Financial%20Inquiry"
          className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 ring-1 ring-zinc-200 transition hover:bg-zinc-50 hover:text-zinc-700 dark:text-zinc-400 dark:ring-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
        >
          Contact Treasurer
        </a>
      </div>
    </nav>
  );
}

type SortKey = "outflow-desc" | "outflow-asc" | "net-desc" | "net-asc" | "txns-desc" | "alpha";

function sortRows(rows: EventRollup[], key: SortKey): EventRollup[] {
  const copy = [...rows];
  switch (key) {
    case "outflow-desc":
      return copy.sort((a, b) => b.outflow - a.outflow);
    case "outflow-asc":
      return copy.sort((a, b) => a.outflow - b.outflow);
    case "net-desc":
      return copy.sort((a, b) => b.net - a.net);
    case "net-asc":
      return copy.sort((a, b) => a.net - b.net);
    case "txns-desc":
      return copy.sort((a, b) => b.txnCount - a.txnCount);
    case "alpha":
      return copy.sort((a, b) =>
        a.eventKey.localeCompare(b.eventKey, undefined, { sensitivity: "base" }),
      );
    default:
      return copy;
  }
}

function CategoryCards({
  current,
  previous,
  fyCurrentLabel,
  fyPreviousLabel,
  overrides,
  onEdit,
}: {
  current: EventRollup[];
  previous: EventRollup[];
  fyCurrentLabel: string;
  fyPreviousLabel: string;
  overrides: EventOverride[];
  onEdit?: (accountCode: string, eventKey: string, fy: number, inflow: number, outflow: number) => void;
}) {
  const manualGroups: ManualGroupEntry[] = useMemo(
    () => overrides.filter((o) => o.group_name).map((o) => ({
      account_code: o.account_code,
      event_key: o.event_key,
      group_name: o.group_name,
    })),
    [overrides],
  );
  const groups = useMemo(() => groupRollups(current, previous, manualGroups), [current, previous, manualGroups]);
  if (groups.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((g) => (
        <GroupCard
          key={g.group}
          group={g}
          fyCurrentLabel={fyCurrentLabel}
          fyPreviousLabel={fyPreviousLabel}
          overrides={overrides}
          onEdit={onEdit ?? undefined}
          rollups={current}
        />
      ))}
    </div>
  );
}

function YoyBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const up = pct > 0;
  const flat = Math.abs(pct) < 0.5;
  if (flat) return null;
  return (
    <span
      className={[
        "ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
        up
          ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"
          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
      ].join(" ")}
    >
      {up ? "↑" : "↓"} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function GroupCard({
  group: g,
  fyCurrentLabel,
  fyPreviousLabel,
  overrides,
  onEdit,
  rollups,
}: {
  group: GroupedCategory;
  fyCurrentLabel: string;
  fyPreviousLabel: string;
  overrides: EventOverride[];
  onEdit?: (accountCode: string, eventKey: string, fy: number, inflow: number, outflow: number) => void;
  rollups: EventRollup[];
}) {
  const [open, setOpen] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const enter = () => {
    clearTimeout(timeout.current);
    setOpen(true);
  };
  const leave = () => {
    timeout.current = setTimeout(() => setOpen(false), 150);
  };

  const isGrouped = g.subEvents.length > 1;

  const matchingOverrides = overrides.filter((o) => g.subEvents.includes(o.event_key));
  const projRevenue = matchingOverrides.reduce((s, o) => s + (o.projected_revenue ?? 0), 0);
  const projExpenses = matchingOverrides.reduce((s, o) => s + (o.projected_expenses ?? 0), 0);
  const groupDescription = matchingOverrides.find((o) => o.description)?.description;
  const displayName = matchingOverrides.find((o) => o.display_name)?.display_name;

  const firstRollup = rollups.find((r) => g.subEvents.includes(r.eventKey));
  const editAccountCode = firstRollup?.accountCode ?? "";
  const editFy = firstRollup?.fiscalYearStart ?? 0;
  const editEventKey = g.subEvents[0] ?? g.group;

  return (
    <div
      className="relative rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
      onMouseEnter={enter}
      onMouseLeave={leave}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
          {displayName || g.group}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isGrouped && (
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              {g.subEvents.length} events
            </span>
          )}
          {onEdit && <EditButton onClick={() => onEdit(editAccountCode, editEventKey, editFy, g.currentInflow, g.currentOutflow)} />}
        </div>
      </div>
      {groupDescription && (
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 truncate">{groupDescription}</p>
      )}

      <div className="mt-2 flex items-baseline gap-3">
        <div>
          <span className="text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatMoney(g.currentInflow)}
          </span>
          <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-400">revenue</span>
          <YoyBadge current={g.currentInflow} previous={g.previousInflow} />
        </div>
      </div>
      <div className="mt-1 flex items-baseline gap-3">
        <div>
          <span className="text-lg font-semibold tabular-nums text-rose-700 dark:text-rose-400">
            {formatMoney(g.currentOutflow)}
          </span>
          <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-400">expenses</span>
          <YoyBadge current={g.currentOutflow} previous={g.previousOutflow} />
        </div>
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

      {projRevenue > 0 && (
        <ProjectionBar projected={projRevenue} actual={g.currentInflow} label="Rev" />
      )}
      {projExpenses > 0 && (
        <ProjectionBar projected={projExpenses} actual={g.currentOutflow} label="Exp" />
      )}

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-80 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {g.group}
          </div>

          <div className="mb-2 grid grid-cols-3 gap-1 text-[11px]">
            <div />
            <div className="text-right font-medium text-zinc-500 dark:text-zinc-400">{fyCurrentLabel}</div>
            <div className="text-right font-medium text-zinc-500 dark:text-zinc-400">{fyPreviousLabel}</div>

            <div className="text-zinc-500 dark:text-zinc-400">Inflow</div>
            <div className="text-right tabular-nums text-emerald-700 dark:text-emerald-400">{formatMoney(g.currentInflow)}</div>
            <div className="text-right tabular-nums text-emerald-700/60 dark:text-emerald-400/60">{formatMoney(g.previousInflow)}</div>

            <div className="text-zinc-500 dark:text-zinc-400">Outflow</div>
            <div className="text-right tabular-nums text-rose-700 dark:text-rose-400">{formatMoney(g.currentOutflow)}</div>
            <div className="text-right tabular-nums text-rose-700/60 dark:text-rose-400/60">{formatMoney(g.previousOutflow)}</div>

            <div className="text-zinc-500 dark:text-zinc-400">Net</div>
            <div className="text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-100">{formatMoney(g.currentNet)}</div>
            <div className="text-right tabular-nums text-zinc-500 dark:text-zinc-400">{formatMoney(g.previousNet)}</div>

            <div className="text-zinc-500 dark:text-zinc-400">Txns</div>
            <div className="text-right tabular-nums text-zinc-700 dark:text-zinc-300">{g.currentTxns}</div>
            <div className="text-right tabular-nums text-zinc-500 dark:text-zinc-400">{g.previousTxns}</div>
          </div>

          {isGrouped && (
            <div className="border-t border-zinc-200 pt-2 dark:border-zinc-700">
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Includes
              </div>
              <ul className="space-y-0.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                {g.subEvents.map((e) => (
                  <li key={e} className="truncate">{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RollupTable({
  title,
  rows,
  showAccountColumn,
  overrides,
  onEdit,
  onMerged,
  readOnly,
}: {
  title: string;
  rows: EventRollup[];
  showAccountColumn: boolean;
  overrides: EventOverride[];
  onEdit?: (accountCode: string, eventKey: string, fy: number, inflow: number, outflow: number) => void;
  onMerged?: () => void;
  readOnly?: boolean;
}) {
  const [sort, setSort] = useState<SortKey>("outflow-desc");
  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState(false);
  const [mergeName, setMergeName] = useState("");
  const [mergeError, setMergeError] = useState("");

  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === sorted.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sorted.map((r) => `${r.accountCode}|${r.eventKey}|${r.fiscalYearStart}`)));
    }
  };

  const selectedRows = sorted.filter((r) => selected.has(`${r.accountCode}|${r.eventKey}|${r.fiscalYearStart}`));

  const doMerge = async () => {
    if (!mergeName.trim() || selectedRows.length < 2) return;
    setMergeError("");
    setMerging(true);
    try {
      const fy = selectedRows[0].fiscalYearStart;
      const events = selectedRows.map((r) => ({ account_code: r.accountCode, event_key: r.eventKey }));
      const res = await fetch("/api/events/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events, fiscal_year_start: fy, group_name: mergeName.trim() }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? "Merge failed");
      }
      setSelected(new Set());
      setMergeName("");
      onMerged?.();
    } catch (e) {
      setMergeError(e instanceof Error ? e.message : "Merge failed");
    } finally {
      setMerging(false);
    }
  };

  const doUnmerge = async () => {
    setMergeError("");
    setMerging(true);
    try {
      const fy = selectedRows[0].fiscalYearStart;
      const events = selectedRows.map((r) => ({ account_code: r.accountCode, event_key: r.eventKey }));
      const res = await fetch("/api/events/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events, fiscal_year_start: fy, group_name: null }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? "Unmerge failed");
      }
      setSelected(new Set());
      onMerged?.();
    } catch (e) {
      setMergeError(e instanceof Error ? e.message : "Unmerge failed");
    } finally {
      setMerging(false);
    }
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
        <p className="text-sm text-zinc-500">No transactions for this year.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {!readOnly && selected.size >= 2 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-blue-200 bg-blue-50 px-4 py-2 dark:border-blue-800 dark:bg-blue-950/40">
          <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
            {selected.size} events selected
          </span>
          <input
            className="rounded-md border border-blue-300 bg-white px-2 py-1 text-sm dark:border-blue-600 dark:bg-blue-900 dark:text-blue-100"
            placeholder="Group name…"
            value={mergeName}
            onChange={(e) => setMergeName(e.target.value)}
          />
          <button
            type="button"
            disabled={merging || !mergeName.trim()}
            onClick={doMerge}
            className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50 hover:bg-blue-700"
          >
            {merging ? "Merging…" : "Merge"}
          </button>
          <button
            type="button"
            disabled={merging}
            onClick={doUnmerge}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          >
            Unmerge
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Clear
          </button>
          {mergeError && <span className="text-sm text-red-600 dark:text-red-400">{mergeError}</span>}
        </div>
      )}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
        >
          <option value="outflow-desc">Highest cost</option>
          <option value="outflow-asc">Lowest cost</option>
          <option value="net-desc">Highest net</option>
          <option value="net-asc">Lowest net</option>
          <option value="txns-desc">Most transactions</option>
          <option value="alpha">A &ndash; Z</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              {!readOnly && (
                <th className="px-2 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === sorted.length && sorted.length > 0}
                    onChange={selectAll}
                    className="h-3.5 w-3.5 rounded border-zinc-300 dark:border-zinc-600"
                  />
                </th>
              )}
              {!readOnly && <th className="px-2 py-2 w-8"></th>}
              {showAccountColumn ? (
                <th className="px-3 py-2">Acct</th>
              ) : null}
              <th className="px-3 py-2">Event / tag</th>
              <th className="px-3 py-2 text-right">In</th>
              <th className="px-3 py-2 text-right">Out</th>
              <th className="px-3 py-2 text-right">Net</th>
              <th className="px-3 py-2 text-right">Proj Rev</th>
              <th className="px-3 py-2 text-right">Proj Exp</th>
              <th className="px-3 py-2 text-right">Txns</th>
              <th className="px-3 py-2 text-right">Receipts</th>
              <th className="px-3 py-2 text-right">Scholarship</th>
              <th className="px-3 py-2 text-right">Tickets*</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {sorted.map((r) => {
              const ov = overrides.find(
                (o) => o.account_code === r.accountCode && o.event_key === r.eventKey && o.fiscal_year_start === r.fiscalYearStart,
              );
              const name = ov?.display_name || r.eventKey;
              const rowKey = `${r.accountCode}|${r.eventKey}|${r.fiscalYearStart}`;
              const isSelected = selected.has(rowKey);
              return (
                <tr
                  key={`${r.accountCode}-${r.eventKey}-${r.fiscalYearStart}`}
                  className={`hover:bg-zinc-50 dark:hover:bg-zinc-900/50 ${isSelected ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}
                >
                  {!readOnly && (
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(rowKey)}
                        className="h-3.5 w-3.5 rounded border-zinc-300 dark:border-zinc-600"
                      />
                    </td>
                  )}
                  {!readOnly && (
                    <td className="px-2 py-2">
                      {onEdit && <EditButton onClick={() => onEdit(r.accountCode, r.eventKey, r.fiscalYearStart, r.inflow, r.outflow)} />}
                    </td>
                  )}
                  {showAccountColumn ? (
                    <td className="px-3 py-2 font-mono text-zinc-700 dark:text-zinc-300">
                      {r.accountCode}
                    </td>
                  ) : null}
                  <td className="max-w-xs px-3 py-2 text-zinc-800 dark:text-zinc-200">
                    <span>{name}</span>
                    {ov?.group_name && (
                      <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                        {ov.group_name}
                      </span>
                    )}
                    {ov?.description && (
                      <span className="ml-1 text-xs text-zinc-400" title={ov.description}>📝</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatMoney(r.inflow)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-rose-700 dark:text-rose-400">
                    {formatMoney(r.outflow)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                    {formatMoney(r.net)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                    {ov?.projected_revenue != null ? formatMoney(ov.projected_revenue) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                    {ov?.projected_expenses != null ? formatMoney(ov.projected_expenses) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                    {r.txnCount}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                    {r.receiptCount}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                    {formatMoney(r.scholarshipNet)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                    {r.ticketLikeCount}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-zinc-200 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800">
        *Ticket-like count = receipt lines with positive amounts (good for ticket
        batches; excludes pure refunds).
      </p>
    </div>
  );
}

function useOverrides(fiscalYearStart: number | null, accountCode: string | null) {
  const [overrides, setOverrides] = useState<EventOverride[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const params = new URLSearchParams();
    if (fiscalYearStart != null) params.set("fy", String(fiscalYearStart));
    if (accountCode) params.set("accountCode", accountCode);
    try {
      const res = await fetch(`/api/events/overrides?${params}`);
      if (res.ok) {
        const j = await res.json();
        setOverrides(j.overrides ?? []);
      }
    } catch {
      // table may not exist yet
    }
    setLoaded(true);
  }, [fiscalYearStart, accountCode]);

  useEffect(() => { refresh(); }, [refresh]);

  const lookup = useCallback(
    (accountCode: string, eventKey: string, fy: number) =>
      overrides.find(
        (o) => o.account_code === accountCode && o.event_key === eventKey && o.fiscal_year_start === fy,
      ) ?? null,
    [overrides],
  );

  return { overrides, loaded, refresh, lookup };
}

function EditEventModal({
  open,
  onClose,
  onSaved,
  accountCode,
  eventKey,
  fiscalYearStart,
  existing,
  actualRevenue,
  actualExpenses,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  accountCode: string;
  eventKey: string;
  fiscalYearStart: number;
  existing: EventOverride | null;
  actualRevenue: number;
  actualExpenses: number;
}) {
  const [displayName, setDisplayName] = useState(existing?.display_name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [projRevenue, setProjRevenue] = useState(
    existing?.projected_revenue != null ? String(existing.projected_revenue) : "",
  );
  const [projExpenses, setProjExpenses] = useState(
    existing?.projected_expenses != null ? String(existing.projected_expenses) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setDisplayName(existing?.display_name ?? "");
      setDescription(existing?.description ?? "");
      setProjRevenue(existing?.projected_revenue != null ? String(existing.projected_revenue) : "");
      setProjExpenses(existing?.projected_expenses != null ? String(existing.projected_expenses) : "");
      setError("");
    }
  }, [open, existing]);

  if (!open) return null;

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/events/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_code: accountCode,
          event_key: eventKey,
          fiscal_year_start: fiscalYearStart,
          display_name: displayName.trim() || null,
          description: description.trim() || null,
          projected_revenue: projRevenue ? Number(projRevenue) : null,
          projected_expenses: projExpenses ? Number(projExpenses) : null,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? "Save failed");
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Edit Event</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {eventKey} · {accountCode} · FY {fiscalYearStart}
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Display name</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={eventKey}
            />
          </label>

          <label className="block text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Description</span>
            <textarea
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes about this event"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Projected revenue</span>
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                value={projRevenue}
                onChange={(e) => setProjRevenue(e.target.value)}
                placeholder="$0.00"
              />
              <span className="mt-0.5 block text-xs text-zinc-400">
                Actual: {formatMoney(actualRevenue)}
              </span>
            </label>
            <label className="block text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Projected expenses</span>
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                value={projExpenses}
                onChange={(e) => setProjExpenses(e.target.value)}
                placeholder="$0.00"
              />
              <span className="mt-0.5 block text-xs text-zinc-400">
                Actual: {formatMoney(actualExpenses)}
              </span>
            </label>
          </div>
        </div>

        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectionBar({ projected, actual, label }: { projected: number; actual: number; label: string }) {
  if (projected <= 0) return null;
  const pct = Math.min((actual / projected) * 100, 100);
  const over = actual > projected;
  return (
    <div className="mt-1">
      <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
        <span>{label} proj: {formatMoney(projected)}</span>
        <span className={over ? "font-medium text-rose-600 dark:text-rose-400" : ""}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="mt-0.5 h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div
          className={`h-1.5 rounded-full transition-all ${over ? "bg-rose-500" : "bg-emerald-500"}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="inline-flex items-center rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      title="Edit event"
    >
      ✎
    </button>
  );
}

export default function DashboardClient(props: {
  accounts: Account[];
  scopeMode: "overview" | "account";
  scopeAccountCode: string | null;
  lastImportAtIso: string | null;
  rollupsCurrent: EventRollup[];
  rollupsPrevious: EventRollup[];
  chartRollupsCurrent: EventRollup[];
  chartRollupsPrevious: EventRollup[];
  chartFyCurrentLabel: string;
  chartFyPreviousLabel: string;
  chartsUsedAdaptiveYears: boolean;
  fyCurrentLabel: string;
  fyPreviousLabel: string;
  /** FY labels matching rollup table rows (aligned with chart data years). */
  dataFyCurrentLabel: string;
  dataFyPreviousLabel: string;
  role?: "admin" | "journalist";
}) {
  const isAdmin = props.role !== "journalist";
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const currentFy = props.rollupsCurrent[0]?.fiscalYearStart ?? null;
  const { overrides, refresh: refreshOverrides, lookup: lookupOverride } = useOverrides(
    null,
    props.scopeMode === "account" ? props.scopeAccountCode : null,
  );

  const [editTarget, setEditTarget] = useState<{
    accountCode: string;
    eventKey: string;
    fiscalYearStart: number;
    actualRevenue: number;
    actualExpenses: number;
  } | null>(null);
  const [qFy, setQFy] = useState(
    String(
      new Date().getMonth() >= 6
        ? new Date().getFullYear()
        : new Date().getFullYear() - 1,
    ),
  );
  const [qN, setQN] = useState("3");
  const [reportFormat, setReportFormat] = useState<"gdoc" | "docx" | "pdf">(
    "gdoc",
  );

  const showAcctCol = props.scopeMode === "overview";
  const apiAccountFilter =
    props.scopeMode === "account" ? props.scopeAccountCode : null;

  const headers = (): HeadersInit => {
    const h: Record<string, string> = {};
    if (secret) h["x-import-secret"] = secret;
    return h;
  };

  const upload = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setStatus(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/import", {
        method: "POST",
        body: fd,
        headers: headers(),
      });
      const j = (await res.json()) as {
        error?: string;
        parsedRows?: number;
        account?: { accountName?: string; accountCode?: string };
      };
      if (res.status === 401) {
        throw new Error(
          'Unauthorized — if IMPORT_SECRET is set on the server, type the same value in “Import secret” above (or unset it for local-only dev).',
        );
      }
      if (!res.ok) throw new Error(j.error ?? res.statusText);
      if ((j.parsedRows ?? 0) === 0) {
        setStatus(
          `No transaction rows found in “${file.name}”. Use the ASBWORKS Account Statement export (the “Excel” download is HTML; .xls or .html both work).`,
        );
        await router.refresh();
        return;
      }
      setStatus(
        `Imported ${j.parsedRows} rows for ${j.account?.accountName} (${j.account?.accountCode}). Reloading…`,
      );
      await router.refresh();
      window.location.reload();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const pushSheets = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/google/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify({
          accountCode: apiAccountFilter,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? res.statusText);
      setStatus(`Sheet updated (${j.rowCount} rows at ${j.updatedRange})`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Sheet sync failed");
    } finally {
      setBusy(false);
    }
  };

  const genDoc = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/google/doc", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify({
          fiscalYearStart: parseInt(qFy, 10),
          quarter: parseInt(qN, 10),
          accountCode: apiAccountFilter,
          format: reportFormat,
        }),
      });
      if (reportFormat === "gdoc") {
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? res.statusText);
        setStatus(`Doc created: ${j.docUrl}`);
        return;
      }
      if (!res.ok) {
        const errText = await res.text();
        let msg = `Download failed (${res.status})`;
        try {
          const parsed = JSON.parse(errText) as { error?: string };
          if (parsed.error) msg = parsed.error;
        } catch {
          if (
            errText &&
            !errText.includes("<!DOCTYPE") &&
            errText.length < 400
          ) {
            msg = errText.trim();
          }
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      let fname = `quarter-report.${reportFormat}`;
      const m = cd?.match(/filename="([^"]+)"/);
      if (m?.[1]) fname = m[1];
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = fname;
      a.click();
      URL.revokeObjectURL(u);
      setStatus(`Downloaded ${fname}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Report export failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <AccountNav accounts={props.accounts} />

      <LastUpdatedSection
        iso={props.lastImportAtIso}
        scopeMode={props.scopeMode}
      />

      {isAdmin && <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
          Controls
        </h2>
        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              Import secret (optional locally; set in production)
            </span>
            <input
              type="password"
              autoComplete="off"
              placeholder="IMPORT_SECRET"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
          </label>

          <div className="flex max-w-md flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              Upload Account Statement (.xls or .html)
            </span>
            <input
              type="file"
              accept=".xls,.html,text/html,application/vnd.ms-excel"
              disabled={busy}
              className="text-sm file:mr-2 file:rounded file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-white dark:file:bg-zinc-100 dark:file:text-zinc-900"
              onChange={(e) => upload(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              In ASBWORKS, run the report named like{" "}
              <span className="font-medium text-zinc-600 dark:text-zinc-300">
                Account Statement Report
              </span>{" "}
              and download. That file is HTML whether it ends in{" "}
              <code className="rounded bg-zinc-200 px-1 text-[0.8rem] dark:bg-zinc-800">
                .xls
              </code>{" "}
              or{" "}
              <code className="rounded bg-zinc-200 px-1 text-[0.8rem] dark:bg-zinc-800">
                .html
              </code>
              — both are fine. Import runs as soon as you choose a file. Regular
              Excel{" "}
              <code className="rounded bg-zinc-200 px-1 text-[0.8rem] dark:bg-zinc-800">
                .xlsx
              </code>{" "}
              exports are not supported.
            </p>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={pushSheets}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Push summary → Google Sheet
          </button>

          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">
                Report FY start
              </span>
              <input
                className="w-24 rounded-md border border-zinc-300 bg-white px-2 py-2 font-mono dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                value={qFy}
                onChange={(e) => setQFy(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Quarter</span>
              <select
                className="rounded-md border border-zinc-300 bg-white px-2 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                value={qN}
                onChange={(e) => setQN(e.target.value)}
              >
                <option value="1">Q1 (Jul–Sep)</option>
                <option value="2">Q2 (Oct–Dec)</option>
                <option value="3">Q3 (Jan–Mar)</option>
                <option value="4">Q4 (Apr–Jun)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Format</span>
              <select
                className="rounded-md border border-zinc-300 bg-white px-2 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                value={reportFormat}
                onChange={(e) =>
                  setReportFormat(e.target.value as "gdoc" | "docx" | "pdf")
                }
              >
                <option value="gdoc">Google Doc (cloud)</option>
                <option value="docx">Word (.docx download)</option>
                <option value="pdf">PDF (download)</option>
              </select>
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={genDoc}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            >
              {reportFormat === "gdoc"
                ? "Create Google Doc"
                : "Download report"}
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Sheet/Doc actions use{" "}
          {props.scopeMode === "overview"
            ? "all accounts"
            : `only ${props.scopeAccountCode}`}
          . Quarter reports can open in Google Docs or download as .docx / PDF
          (no Google account needed for downloads).
        </p>
        {status ? (
          <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">{status}</p>
        ) : null}
      </section>}

      {props.scopeMode === "overview" ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Net by account ({props.dataFyCurrentLabel})
          </h2>
          <OverviewAccountTotals
            rows={props.rollupsCurrent}
            accounts={props.accounts}
            dataFyLabel={props.dataFyCurrentLabel}
          />
        </section>
      ) : null}

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

      {props.rollupsCurrent.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            By event ({props.dataFyCurrentLabel})
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Hover over a card for a full breakdown and year-over-year comparison.
            Related events (Prom, Homecoming, etc.) are combined.{isAdmin ? " Click ✎ to edit." : ""}
          </p>
          <CategoryCards
            current={props.rollupsCurrent}
            previous={props.rollupsPrevious}
            fyCurrentLabel={props.dataFyCurrentLabel}
            fyPreviousLabel={props.dataFyPreviousLabel}
            overrides={overrides}
            onEdit={isAdmin
              ? (accountCode, eventKey, fy, inflow, outflow) =>
                  setEditTarget({ accountCode, eventKey, fiscalYearStart: fy, actualRevenue: inflow, actualExpenses: outflow })
              : undefined
            }
          />
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-1">
        <RollupTable
          title={`Rollups (${props.dataFyCurrentLabel})`}
          rows={props.rollupsCurrent}
          showAccountColumn={showAcctCol}
          overrides={overrides}
          onEdit={isAdmin
            ? (accountCode, eventKey, fy, inflow, outflow) =>
                setEditTarget({ accountCode, eventKey, fiscalYearStart: fy, actualRevenue: inflow, actualExpenses: outflow })
            : undefined
          }
          onMerged={isAdmin ? refreshOverrides : undefined}
          readOnly={!isAdmin}
        />
        <RollupTable
          title={`Rollups (${props.dataFyPreviousLabel})`}
          rows={props.rollupsPrevious}
          showAccountColumn={showAcctCol}
          overrides={overrides}
          onEdit={isAdmin
            ? (accountCode, eventKey, fy, inflow, outflow) =>
                setEditTarget({ accountCode, eventKey, fiscalYearStart: fy, actualRevenue: inflow, actualExpenses: outflow })
            : undefined
          }
          onMerged={isAdmin ? refreshOverrides : undefined}
          readOnly={!isAdmin}
        />
      </div>

      {isAdmin && editTarget && (
        <EditEventModal
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={refreshOverrides}
          accountCode={editTarget.accountCode}
          eventKey={editTarget.eventKey}
          fiscalYearStart={editTarget.fiscalYearStart}
          existing={lookupOverride(editTarget.accountCode, editTarget.eventKey, editTarget.fiscalYearStart)}
          actualRevenue={editTarget.actualRevenue}
          actualExpenses={editTarget.actualExpenses}
        />
      )}
    </div>
  );
}
