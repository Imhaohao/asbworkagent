"use client";

import { useEffect, useMemo, useState } from "react";
import type { EventRollup } from "@/lib/aggregate";
import {
  buildExcessPieModel,
  sumOutflow,
} from "@/lib/fiscal-chart-metrics";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** High-contrast tooltip (readable on dark charts and in dark mode). */
const TOOLTIP_CONTENT = {
  backgroundColor: "#fafafa",
  border: "2px solid #09090b",
  borderRadius: 10,
  boxShadow: "0 10px 28px rgba(0,0,0,0.4)",
};
const TOOLTIP_LABEL_STYLE = {
  color: "#3f3f46",
  fontWeight: 700,
  fontSize: 12,
};
const TOOLTIP_ITEM_STYLE = {
  color: "#09090b",
  fontWeight: 600,
  fontSize: 13,
};

/**
 * Tracks `dark` on <html> (ThemeToggle). useSyncExternalStore + MutationObserver
 * caused client crashes with Recharts on some navigations (e.g. heavy account pages).
 */
function useHtmlDarkClass(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const read = () =>
      setDark(document.documentElement.classList.contains("dark"));
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);
  return dark;
}

function formatCompact$(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function FiscalChartsInner({
  rollupsCurrent,
  rollupsPrevious,
  fyCurrentLabel,
  fyPreviousLabel,
  chartsUsedAdaptiveYears,
  calendarFyCurrentLabel,
  calendarFyPreviousLabel,
}: {
  rollupsCurrent: EventRollup[];
  rollupsPrevious: EventRollup[];
  fyCurrentLabel: string;
  fyPreviousLabel: string;
  chartsUsedAdaptiveYears: boolean;
  calendarFyCurrentLabel: string;
  calendarFyPreviousLabel: string;
}) {
  const dark = useHtmlDarkClass();
  const axisColor = dark ? "#a1a1aa" : "#52525b";
  const gridColor = dark ? "#3f3f46" : "#e4e4e7";

  const barData = useMemo(() => {
    const last = sumOutflow(rollupsPrevious);
    const curr = sumOutflow(rollupsCurrent);
    return [
      {
        label: `Earlier FY in chart (${fyPreviousLabel})`,
        spending: last,
      },
      { label: `Later FY in chart (${fyCurrentLabel})`, spending: curr },
    ];
  }, [rollupsCurrent, rollupsPrevious, fyCurrentLabel, fyPreviousLabel]);

  const pieModel = useMemo(
    () => buildExcessPieModel(rollupsPrevious, rollupsCurrent),
    [rollupsPrevious, rollupsCurrent],
  );

  const barEmpty = barData.every((d) => d.spending === 0);
  const pieEmpty = pieModel.slices.length === 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section
        className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        aria-labelledby="fy-bar-heading"
      >
        <h2
          id="fy-bar-heading"
          className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
        >
          Spending (outflow) — last year vs this year
        </h2>
        {chartsUsedAdaptiveYears ? (
          <p className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-200">
            Using FY {fyPreviousLabel} vs {fyCurrentLabel} (most recent data in
            this view). Calendar tables still use {calendarFyPreviousLabel} /{" "}
            {calendarFyCurrentLabel}.
          </p>
        ) : null}
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Total costs across event rollups in scope (positive outflows from
          ASBWORKS imports).
        </p>
        {barEmpty ? (
          <p className="mt-6 text-sm text-zinc-500">No spending in data yet.</p>
        ) : (
          <div className="mt-4 h-72 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barData}
                margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: axisColor, fontSize: 11 }}
                  interval={0}
                  angle={-12}
                  textAnchor="end"
                  height={56}
                />
                <YAxis
                  tick={{ fill: axisColor, fontSize: 11 }}
                  tickFormatter={(v) => formatCompact$(Number(v))}
                />
                <Tooltip
                  formatter={(value: number) =>
                    value.toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                    })
                  }
                  contentStyle={TOOLTIP_CONTENT}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                />
                <Bar
                  dataKey="spending"
                  name="Spending (outflow)"
                  fill="#6366f1"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section
        className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        aria-labelledby="fy-pie-heading"
      >
        <h2
          id="fy-pie-heading"
          className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
        >
          Inflow vs spend &amp; last-year cost proxy
        </h2>
        {chartsUsedAdaptiveYears ? (
          <p className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-200">
            Pie uses the same FY pair as the bar chart ({fyPreviousLabel} anchor
            vs {fyCurrentLabel} YTD).
          </p>
        ) : null}
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Uses <strong>earlier FY total outflow</strong> (in this chart pair) as a
          simple full‑year cost anchor.{" "}
          <span className="text-amber-700 dark:text-amber-400">Amber</span> only
          shows if that anchor is <strong>greater</strong> than this year’s
          spending so far;{" "}
          <span className="text-green-700 dark:text-green-400">green</span> is
          estimated excess inflow after spend and that reserve (not bank cash).
        </p>
        {pieEmpty ? (
          <p className="mt-6 text-sm text-zinc-500">
            Not enough data to chart — import statements for this and last
            fiscal year.
          </p>
        ) : (
          <>
            <div className="mt-2 h-72 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieModel.slices}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={88}
                    paddingAngle={2}
                    label={(props: { percent?: unknown }) => {
                      const raw = props?.percent;
                      const p =
                        typeof raw === "number"
                          ? raw
                          : typeof raw === "string"
                            ? Number(raw)
                            : NaN;
                      if (!Number.isFinite(p) || p <= 0.06) return "";
                      return `${(p * 100).toFixed(0)}%`;
                    }}
                    labelLine={false}
                  >
                    {pieModel.slices.map((s) => (
                      <Cell key={s.key} fill={s.fill} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) =>
                      value.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                      })
                    }
                    contentStyle={TOOLTIP_CONTENT}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: axisColor }}
                    formatter={(value) => (
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {value}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <dl className="mt-2 grid gap-1 border-t border-zinc-200 pt-3 text-xs dark:border-zinc-800">
              <div className="flex justify-between gap-2 text-zinc-600 dark:text-zinc-400">
                <dt>YTD inflow (later FY in chart)</dt>
                <dd className="font-mono tabular-nums text-zinc-900 dark:text-zinc-100">
                  {formatCompact$(pieModel.thisYearInflow)}
                </dd>
              </div>
              <div className="flex justify-between gap-2 text-zinc-600 dark:text-zinc-400">
                <dt>YTD outflow (spent)</dt>
                <dd className="font-mono tabular-nums text-zinc-900 dark:text-zinc-100">
                  {formatCompact$(pieModel.thisYearOutflow)}
                </dd>
              </div>
              {pieModel.lastYearOutflow > 0 ? (
                <div className="flex justify-between gap-2 text-zinc-600 dark:text-zinc-400">
                  <dt>Earlier FY outflow (anchor)</dt>
                  <dd className="font-mono tabular-nums text-zinc-900 dark:text-zinc-100">
                    {formatCompact$(pieModel.lastYearOutflow)}
                  </dd>
                </div>
              ) : null}
              {pieModel.shortfallVsAnchor ? (
                <p className="text-amber-800 dark:text-amber-200">
                  YTD inflow is below spend plus the implied remainder vs the
                  anchor FY — excess slice is $0.
                </p>
              ) : null}
            </dl>
          </>
        )}
      </section>
    </div>
  );
}

export default function FiscalCharts(props: {
  rollupsCurrent: EventRollup[];
  rollupsPrevious: EventRollup[];
  fyCurrentLabel: string;
  fyPreviousLabel: string;
  chartsUsedAdaptiveYears: boolean;
  calendarFyCurrentLabel: string;
  calendarFyPreviousLabel: string;
}) {
  return <FiscalChartsInner {...props} />;
}
