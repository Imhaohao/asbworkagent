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
