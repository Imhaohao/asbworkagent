/** California school fiscal year: July 1 → June 30. */

export function fiscalYearStart(date: Date): number {
  const y = date.getFullYear();
  const m = date.getMonth();
  return m >= 6 ? y : y - 1;
}

export function fiscalYearLabel(startYear: number): string {
  return `${startYear}–${(startYear + 1).toString().slice(-2)}`;
}

/** Q1 Jul–Sep, Q2 Oct–Dec, Q3 Jan–Mar, Q4 Apr–Jun */
export function fiscalQuarter(date: Date): 1 | 2 | 3 | 4 {
  const m = date.getMonth();
  if (m >= 6 && m <= 8) return 1;
  if (m >= 9 && m <= 11) return 2;
  if (m >= 0 && m <= 2) return 3;
  return 4;
}

export function quarterLabel(startYear: number, quarter: 1 | 2 | 3 | 4): string {
  const ranges: Record<number, string> = {
    1: `Jul–Sep ${startYear}`,
    2: `Oct–Dec ${startYear}`,
    3: `Jan–Mar ${startYear + 1}`,
    4: `Apr–Jun ${startYear + 1}`,
  };
  return `Q${quarter} (${ranges[quarter]})`;
}

/** California-style season name aligned to fiscal quarters (Q1 Fall … Q4 Summer). */
export function quarterSeasonName(quarter: 1 | 2 | 3 | 4): string {
  const names = { 1: "Fall", 2: "Winter", 3: "Spring", 4: "Summer" } as const;
  return names[quarter];
}

/** Wording for constitution text: ASB publishes after first and third quarters. */
export function constitutionQuarterLabel(quarter: 1 | 2 | 3 | 4): string {
  if (quarter === 1) return "First Quarter";
  if (quarter === 3) return "Third Quarter";
  return `${quarterSeasonName(quarter)} Quarter`;
}

/**
 * Choose which two fiscal years feed the dashboard charts.
 * If the calendar “current / previous” FYs have no rows for this scope (e.g. General
 * only has older imports), use the two most recent FYs present in data so bars/pie
 * are not empty.
 */
export function chartFiscalYearPair(
  rollups: { fiscalYearStart: number }[],
  fyCalendarCurrent: number,
  fyCalendarPrevious: number,
): { curr: number; prev: number; usedAdaptiveYears: boolean } {
  const hasRows = (fy: number) =>
    rollups.some((r) => r.fiscalYearStart === fy);

  if (hasRows(fyCalendarCurrent) || hasRows(fyCalendarPrevious)) {
    return {
      curr: fyCalendarCurrent,
      prev: fyCalendarPrevious,
      usedAdaptiveYears: false,
    };
  }

  const years = [...new Set(rollups.map((r) => r.fiscalYearStart))].sort(
    (a, b) => b - a,
  );

  if (years.length >= 2) {
    return {
      curr: years[0],
      prev: years[1],
      usedAdaptiveYears: true,
    };
  }
  if (years.length === 1) {
    return {
      curr: years[0],
      prev: years[0] - 1,
      usedAdaptiveYears: true,
    };
  }

  return {
    curr: fyCalendarCurrent,
    prev: fyCalendarPrevious,
    usedAdaptiveYears: false,
  };
}

export function quarterDateRange(
  fyStart: number,
  quarter: 1 | 2 | 3 | 4,
): { start: Date; end: Date } {
  if (quarter === 1)
    return { start: new Date(fyStart, 6, 1), end: new Date(fyStart, 8, 30) };
  if (quarter === 2)
    return { start: new Date(fyStart, 9, 1), end: new Date(fyStart, 11, 31) };
  if (quarter === 3)
    return {
      start: new Date(fyStart + 1, 0, 1),
      end: new Date(fyStart + 1, 2, 31),
    };
  return {
    start: new Date(fyStart + 1, 3, 1),
    end: new Date(fyStart + 1, 5, 30),
  };
}
