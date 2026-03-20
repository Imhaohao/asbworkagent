"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { EventRollup } from "@/lib/aggregate";

type Account = { account_code: string; account_name: string };

function formatMoney(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function RollupTable({
  title,
  rows,
}: {
  title: string;
  rows: EventRollup[];
}) {
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
      <h2 className="border-b border-zinc-200 px-4 py-3 text-lg font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
        {title}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2">Acct</th>
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
            {rows.map((r) => (
              <tr
                key={`${r.accountCode}-${r.eventKey}-${r.fiscalYearStart}`}
                className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
              >
                <td className="px-3 py-2 font-mono text-zinc-700 dark:text-zinc-300">
                  {r.accountCode}
                </td>
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
  selectedAccount: string;
  rollupsCurrent: EventRollup[];
  rollupsPrevious: EventRollup[];
  fyCurrentLabel: string;
  fyPreviousLabel: string;
}) {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [qFy, setQFy] = useState(String(new Date().getMonth() >= 6 ? new Date().getFullYear() : new Date().getFullYear() - 1));
  const [qN, setQN] = useState("3");

  const headers = (): HeadersInit => {
    const h: Record<string, string> = {};
    if (secret) h["x-import-secret"] = secret;
    return h;
  };

  const onAccountChange = (code: string) => {
    router.push(code ? `/?account=${encodeURIComponent(code)}` : "/");
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
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? res.statusText);
      setStatus(`Imported ${j.parsedRows} rows for ${j.account?.accountName} (${j.account?.accountCode})`);
      router.refresh();
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
          accountCode: props.selectedAccount || null,
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
          accountCode: props.selectedAccount || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? res.statusText);
      setStatus(`Doc created: ${j.docUrl}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Doc failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
          Controls
        </h2>
        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Account</span>
            <select
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              value={props.selectedAccount}
              onChange={(e) => onAccountChange(e.target.value)}
            >
              <option value="">All accounts</option>
              {props.accounts.map((a) => (
                <option key={a.account_code} value={a.account_code}>
                  {a.account_code} — {a.account_name || "Unnamed"}
                </option>
              ))}
            </select>
          </label>

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

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              Upload ASBWORKS “Excel” export (.xls)
            </span>
            <input
              type="file"
              accept=".xls,.html,text/html"
              disabled={busy}
              className="text-sm file:mr-2 file:rounded file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-white dark:file:bg-zinc-100 dark:file:text-zinc-900"
              onChange={(e) => upload(e.target.files?.[0] ?? null)}
            />
          </label>

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
              <span className="text-zinc-600 dark:text-zinc-400">Report FY start</span>
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
            <button
              type="button"
              disabled={busy}
              onClick={genDoc}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            >
              Quarterly Google Doc
            </button>
          </div>
        </div>
        {status ? (
          <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">{status}</p>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-1">
        <RollupTable
          title={`This fiscal year (${props.fyCurrentLabel})`}
          rows={props.rollupsCurrent}
        />
        <RollupTable
          title={`Prior fiscal year (${props.fyPreviousLabel})`}
          rows={props.rollupsPrevious}
        />
      </div>
    </div>
  );
}
