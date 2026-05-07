import type { EventRollup } from "./aggregate";

export function sumOutflow(rows: EventRollup[]): number {
  return rows.reduce((a, r) => a + r.outflow, 0);
}

export function sumInflow(rows: EventRollup[]): number {
  return rows.reduce((a, r) => a + r.inflow, 0);
}

export type ExcessPieSlice = {
  key: string;
  name: string;
  value: number;
  fill: string;
};

export type ExcessPieModel = {
  slices: ExcessPieSlice[];
  /** Last FY total outflow (cost anchor) */
  lastYearOutflow: number;
  /** This FY outflow YTD */
  thisYearOutflow: number;
  /** This FY inflow YTD */
  thisYearInflow: number;
  impliedRemainder: number;
  excessInflow: number;
  netYtd: number;
  /** True when YTD inflow is less than spend plus implied remainder vs last FY */
  shortfallVsAnchor: boolean;
};

/**
 * Pie interprets “future cost” as **last fiscal year’s total outflow** (same events/accounts in data).
 * - **Spent**: this FY outflow so far
 * - **Implied future (vs last FY)**: max(0, lastFY_outflow − thisFY_outflow) — room still “budgeted” to last year’s scale
 * - **Excess**: max(0, inflow_YTD − spent − implied_future) — inflow left after that simple reserve
 *
 * If there is no prior‑year outflow in the data, the pie shows only **Spent** and **unspent inflow**.
 */
export function buildExcessPieModel(
  rollupsPrevious: EventRollup[],
  rollupsCurrent: EventRollup[],
): ExcessPieModel {
  const L = sumOutflow(rollupsPrevious);
  const S = sumOutflow(rollupsCurrent);
  const I = sumInflow(rollupsCurrent);
  const netYtd = I - S;

  const blue = "#3b82f6";
  const amber = "#f59e0b";
  const green = "#22c55e";

  if (L <= 0) {
    const surplus = Math.max(0, I - S);
    const slices: ExcessPieSlice[] = [];
    if (S > 0) {
      slices.push({ key: "spent", name: "Spent (YTD)", value: S, fill: blue });
    }
    if (surplus > 0) {
      slices.push({
        key: "surplus",
        name: "Unspent inflow (YTD)",
        value: surplus,
        fill: green,
      });
    }
    return {
      slices,
      lastYearOutflow: L,
      thisYearOutflow: S,
      thisYearInflow: I,
      impliedRemainder: 0,
      excessInflow: surplus,
      netYtd,
      shortfallVsAnchor: false,
    };
  }

  const impliedRemainder = Math.max(0, L - S);
  const excessInflow = Math.max(0, I - S - impliedRemainder);
  const shortfallVsAnchor = I + 1e-6 < S + impliedRemainder;

  const slices: ExcessPieSlice[] = [];
  if (S > 0) {
    slices.push({ key: "spent", name: "Spent (YTD)", value: S, fill: blue });
  }
  if (impliedRemainder > 0) {
    slices.push({
      key: "implied",
      name: "Implied future (vs last FY outflow)",
      value: impliedRemainder,
      fill: amber,
    });
  }
  if (excessInflow > 0) {
    slices.push({
      key: "excess",
      name: "Excess inflow (after spend + proxy)",
      value: excessInflow,
      fill: green,
    });
  }

  return {
    slices,
    lastYearOutflow: L,
    thisYearOutflow: S,
    thisYearInflow: I,
    impliedRemainder,
    excessInflow,
    netYtd,
    shortfallVsAnchor,
  };
}
