"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import type { EventRollup } from "@/lib/aggregate";
import { groupRollups, type GroupedCategory } from "@/lib/event-groups";
import { sortAccountsForNav } from "@/lib/account-nav-order";

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
      className="mb-8 flex flex-wrap gap-2 border-b border-zinc-200 pb-4 dark:border-zinc-800"
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
}: {
  current: EventRollup[];
  previous: EventRollup[];
  fyCurrentLabel: string;
  fyPreviousLabel: string;
}) {
  const groups = useMemo(() => groupRollups(current, previous), [current, previous]);
  if (groups.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((g) => (
        <GroupCard
          key={g.group}
          group={g}
          fyCurrentLabel={fyCurrentLabel}
          fyPreviousLabel={fyPreviousLabel}
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
}: {
  group: GroupedCategory;
  fyCurrentLabel: string;
  fyPreviousLabel: string;
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

  return (
    <div
      className="relative rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
      onMouseEnter={enter}
      onMouseLeave={leave}
    >
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
}: {
  title: string;
  rows: EventRollup[];
  showAccountColumn: boolean;
}) {
  const [sort, setSort] = useState<SortKey>("outflow-desc");
  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);

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
              {showAccountColumn ? (
                <th className="px-3 py-2">Acct</th>
              ) : null}
              <th className="px-3 py-2">Event / tag</th>
              <th className="px-3 py-2 text-right">In</th>
              <th className="px-3 py-2 text-right">Out</th>
              <th className="px-3 py-2 text-right">Net</th>
              <th className="px-3 py-2 text-right">Txns</th>
              <th className="px-3 py-2 text-right">Receipts</th>
              <th className="px-3 py-2 text-right">Scholarship</th>
              <th className="px-3 py-2 text-right">Tickets*</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {sorted.map((r) => (
              <tr
                key={`${r.accountCode}-${r.eventKey}-${r.fiscalYearStart}`}
                className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
              >
                {showAccountColumn ? (
                  <td className="px-3 py-2 font-mono text-zinc-700 dark:text-zinc-300">
                    {r.accountCode}
                  </td>
                ) : null}
                <td className="max-w-xs px-3 py-2 text-zinc-800 dark:text-zinc-200">
                  {r.eventKey}
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
            ))}
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
}) {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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

      <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
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
      </section>

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
            Related events (Prom, Homecoming, etc.) are combined.
          </p>
          <CategoryCards
            current={props.rollupsCurrent}
            previous={props.rollupsPrevious}
            fyCurrentLabel={props.dataFyCurrentLabel}
            fyPreviousLabel={props.dataFyPreviousLabel}
          />
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-1">
        <RollupTable
          title={`Rollups (${props.dataFyCurrentLabel})`}
          rows={props.rollupsCurrent}
          showAccountColumn={showAcctCol}
        />
        <RollupTable
          title={`Rollups (${props.dataFyPreviousLabel})`}
          rows={props.rollupsPrevious}
          showAccountColumn={showAcctCol}
        />
      </div>
    </div>
  );
}
