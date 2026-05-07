import type { EventRollup } from "./aggregate";
import {
  constitutionQuarterLabel,
  fiscalYearLabel,
  quarterLabel,
  quarterSeasonName,
} from "./fiscal";

export type QuarterReportAccount = {
  account_code: string;
  account_name: string;
};

/** Five columns: line item, TY exp, TY rev, LY exp, LY rev */
export type QuarterTxnTable = {
  caption: string;
  headers: [string, string, string, string, string];
  body: [string, string, string, string, string][];
  footerNote: string;
};

export type QuarterReportAccountSection = {
  heading: string;
  narrative: string;
  table: QuarterTxnTable;
};

export type QuarterReportModel = {
  docTitle: string;
  titleLine1: string;
  titleLine2: string;
  introHeading: string;
  introParagraphs: string[];
  overviewHeading: string;
  overviewParagraphs: string[];
  overviewBullets: string[];
  overviewFooter: string;
  accountSections: QuarterReportAccountSection[];
  noDataMessage: string | null;
  futureHeading: string;
  futureBullets: string[];
  conclusionHeading: string;
  conclusionParagraphs: string[];
};

/**
 * Report order: numeric class accounts (326, 327, …), then General, Dance, Spirit, then others A–Z.
 */
export function sortAccountsForQuarterReport<T extends QuarterReportAccount>(
  accounts: T[],
): T[] {
  const numeric = (code: string) =>
    /^\d+$/.test(code) ? parseInt(code, 10) : Number.POSITIVE_INFINITY;

  const tier = (a: T): number => {
    if (numeric(a.account_code) !== Number.POSITIVE_INFINITY) return 0;
    const h = `${a.account_name} ${a.account_code}`.toLowerCase();
    if (h.includes("general")) return 1;
    if (h.includes("dance")) return 2;
    if (h.includes("spirit")) return 3;
    return 4;
  };

  return [...accounts].sort((a, b) => {
    const d = tier(a) - tier(b);
    if (d !== 0) return d;
    if (tier(a) === 0) return numeric(a.account_code) - numeric(b.account_code);
    return a.account_code.localeCompare(b.account_code);
  });
}

function formatLongDateGb(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const moneyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function quarterMoney(n: number): string {
  return moneyFmt.format(n);
}

function moneyCell(n: number): string {
  if (n === 0) return "—";
  return quarterMoney(n);
}

export function buildAccountTxnTable(
  accountLabel: string,
  fyReport: number,
  rows: EventRollup[],
): QuarterTxnTable {
  const fyThis = fyReport;
  const fyLast = fyReport - 1;

  type Cell = { exp: number; rev: number };
  const byEvent = new Map<string, { ty: Cell; ly: Cell }>();

  for (const r of rows) {
    let bucket = byEvent.get(r.eventKey);
    if (!bucket) {
      bucket = {
        ty: { exp: 0, rev: 0 },
        ly: { exp: 0, rev: 0 },
      };
      byEvent.set(r.eventKey, bucket);
    }
    const cell =
      r.fiscalYearStart === fyThis
        ? bucket.ty
        : r.fiscalYearStart === fyLast
          ? bucket.ly
          : null;
    if (!cell) continue;
    cell.rev += r.inflow;
    cell.exp += r.outflow;
  }

  const orderedKeys = [...byEvent.keys()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );

  let tyTotExp = 0;
  let tyTotRev = 0;
  let lyTotExp = 0;
  let lyTotRev = 0;
  for (const r of rows) {
    if (r.fiscalYearStart === fyThis) {
      tyTotExp += r.outflow;
      tyTotRev += r.inflow;
    } else if (r.fiscalYearStart === fyLast) {
      lyTotExp += r.outflow;
      lyTotRev += r.inflow;
    }
  }
  const tyNet = tyTotRev - tyTotExp;
  const lyNet = lyTotRev - lyTotExp;

  const headers: QuarterTxnTable["headers"] = [
    "Line",
    "TY Exp",
    "TY Rev",
    "LY Exp",
    "LY Rev",
  ];

  const body: QuarterTxnTable["body"] = [
    ["Balance forward", "—", "—", "—", "—"],
  ];

  for (const key of orderedKeys) {
    const b = byEvent.get(key)!;
    if (b.ty.exp + b.ty.rev + b.ly.exp + b.ly.rev === 0) continue;
    body.push([
      key,
      moneyCell(b.ty.exp),
      moneyCell(b.ty.rev),
      moneyCell(b.ly.exp),
      moneyCell(b.ly.rev),
    ]);
  }

  body.push(
    [
      "Net expense/revenue",
      quarterMoney(tyTotExp),
      quarterMoney(tyTotRev),
      quarterMoney(lyTotExp),
      quarterMoney(lyTotRev),
    ],
    [
      "Net change (inflows − outflows)",
      quarterMoney(tyNet),
      "—",
      quarterMoney(lyNet),
      "—",
    ],
  );

  return {
    caption: `Transaction detail — ${accountLabel}`,
    headers,
    body,
    footerNote:
      "Figures come from imported ASBWORKS activity in this quarter only. Balance forward / ledger closing balance are not included—add those from ASBWORKS if needed.",
  };
}

function accountNarrative(
  displayName: string,
  code: string,
  fyStart: number,
  fyLabel: string,
  season: string,
  rows: EventRollup[],
): string {
  if (rows.length === 0) {
    return `No imported transactions for ${displayName} (${code}) in this quarter.`;
  }
  let tyIn = 0;
  let tyOut = 0;
  let lyIn = 0;
  let lyOut = 0;
  for (const r of rows) {
    if (r.fiscalYearStart === fyStart) {
      tyIn += r.inflow;
      tyOut += r.outflow;
    } else if (r.fiscalYearStart === fyStart - 1) {
      lyIn += r.inflow;
      lyOut += r.outflow;
    }
  }
  const tyNet = tyIn - tyOut;
  const lyNet = lyIn - lyOut;
  const parts: string[] = [];
  parts.push(
    `The ${displayName} account (${code}) summarizes ${season} quarter imports for fiscal year ${fyLabel}.`,
  );
  if (tyIn + tyOut > 0) {
    parts.push(
      `For the current fiscal year (${fyLabel}), recorded inflows totaled ${quarterMoney(tyIn)} and outflows ${quarterMoney(tyOut)} (net ${quarterMoney(tyNet)}).`,
    );
  }
  if (lyIn + lyOut > 0) {
    parts.push(
      `For the prior fiscal year, inflows totaled ${quarterMoney(lyIn)} and outflows ${quarterMoney(lyOut)} (net ${quarterMoney(lyNet)}).`,
    );
  }
  return parts.join(" ");
}

export function buildQuarterReportModel(options: {
  fiscalYearStart: number;
  quarter: 1 | 2 | 3 | 4;
  periodStart: Date;
  periodEnd: Date;
  rollups: EventRollup[];
  accounts: QuarterReportAccount[];
  singleAccountCode: string | null;
}): QuarterReportModel {
  const {
    fiscalYearStart: fy,
    quarter,
    periodStart,
    periodEnd,
    rollups,
    accounts,
    singleAccountCode,
  } = options;

  const fyLabel = fiscalYearLabel(fy);
  const season = quarterSeasonName(quarter);
  const qLab = quarterLabel(fy, quarter);
  const constitution = constitutionQuarterLabel(quarter);

  const docTitle = `Paly ASB Budget Report — ${fyLabel} ${season} Quarter`;

  const codesInData = new Set(rollups.map((r) => r.accountCode));
  let orderedAccounts = sortAccountsForQuarterReport(
    accounts.filter((a) => codesInData.has(a.account_code)),
  );
  if (singleAccountCode) {
    orderedAccounts = orderedAccounts.filter(
      (a) => a.account_code === singleAccountCode,
    );
  }

  const accountSections: QuarterReportAccountSection[] = [];
  for (const acct of orderedAccounts) {
    const code = acct.account_code;
    const display =
      acct.account_name?.trim() ||
      `Account ${code}`;
    const sectionTitle = `${display} (${code})`;
    const rows = rollups.filter((r) => r.accountCode === code);
    accountSections.push({
      heading: sectionTitle,
      narrative: accountNarrative(display, code, fy, fyLabel, season, rows),
      table: buildAccountTxnTable(`${display} — ${qLab}`, fy, rows),
    });
  }

  const noDataMessage =
    orderedAccounts.length === 0
      ? "No transactions were found for this quarter and filter. Import ASBWORKS statements for the period or adjust the fiscal year / quarter."
      : null;

  return {
    docTitle,
    titleLine1: "Paly ASB Budget Report",
    titleLine2: `${fyLabel} ${season} Quarter`,
    introHeading: "Charge Statement and Introduction",
    introParagraphs: [
      "As outlined by our revised ASB constitution, Article VII Bylaws – Finances states, “ASB shall publish semester budget reports to the student body by the end of the first and third quarter of each school year.” " +
        `This report marks the ${constitution} report for the period below. It summarizes purchases and receipts recorded in imported ASBWORKS data for Palo Alto High School ASB and its accounts, including class councils, General, Dance, and Spirit, to make expenditures easier to understand.`,
      "ASB is structured to be a net-zero organization for the year: funds raised are put back into programs for students. Revenue and expense lines in the tables use positive dollar amounts in both columns (expenses show money out, revenue shows money in).",
    ],
    overviewHeading: "Overview",
    overviewParagraphs: [
      `The following quarter report summarizes financial activity from imported statements for the reporting window ${formatLongDateGb(periodStart)} through ${formatLongDateGb(periodEnd)} (${qLab}). `,
      `To match typical board reports, activity is split where both fiscal years appear in the import:`,
    ],
    overviewBullets: [
      `Last year — fiscal year ${fiscalYearLabel(fy - 1)} (July 1 ${fy - 1} – June 30 ${fy}).`,
      `This year — fiscal year ${fyLabel} (July 1 ${fy} – June 30 ${fy + 1}).`,
    ],
    overviewFooter:
      "Per-account sections list each event rollup from the import. Net change lines are for this quarter only, not cumulative ledger balances.",
    accountSections,
    noDataMessage,
    futureHeading: "Future Outlook",
    futureBullets: [
      "Action Items:",
      "(Add board follow-ups below.)",
      "- ",
      "- ",
    ],
    conclusionHeading: "Conclusion",
    conclusionParagraphs: [
      "This budget report reflects imported ASBWORKS activity for the quarter above. Positive amounts in expense columns are dollars out; positive amounts in revenue columns are dollars in. Use official ledgers for opening and closing balances where your packet requires them, and edit narrative sections to match your board’s messaging.",
      "Paly ASB is not-for-profit in structure: funds raised for the year are intended to return to student programs. Thank you to everyone who supports transparency in how those funds are used.",
    ],
  };
}

export function quarterReportModelToPlainText(m: QuarterReportModel): string {
  const lines: string[] = [
    m.titleLine1,
    m.titleLine2,
    "",
    m.introHeading,
    "",
    ...m.introParagraphs.flatMap((p) => [p, ""]),
    m.overviewHeading,
    "",
    ...m.overviewParagraphs.flatMap((p) => [p, ""]),
    ...m.overviewBullets.map((b) => `- ${b}`),
    "",
    m.overviewFooter,
    "",
    "————————————————————————————————————————————————————————————————",
    "",
  ];

  for (const sec of m.accountSections) {
    lines.push(sec.heading, "", sec.narrative, "", sec.table.caption, "");
    const [h0, h1, h2, h3, h4] = sec.table.headers;
    lines.push([h0, h1, h2, h3, h4].join("\t"));
    for (const row of sec.table.body) {
      lines.push(row.join("\t"));
    }
    lines.push("", sec.table.footerNote, "");
  }

  if (m.noDataMessage) {
    lines.push(m.noDataMessage, "");
  }

  lines.push(
    m.futureHeading,
    "",
    ...m.futureBullets,
    "",
    m.conclusionHeading,
    "",
    ...m.conclusionParagraphs.flatMap((p) => [p, ""]),
  );

  return lines.join("\n");
}

export function buildQuarterReportDocumentText(options: {
  fiscalYearStart: number;
  quarter: 1 | 2 | 3 | 4;
  periodStart: Date;
  periodEnd: Date;
  rollups: EventRollup[];
  accounts: QuarterReportAccount[];
  singleAccountCode: string | null;
}): { docTitle: string; body: string } {
  const m = buildQuarterReportModel(options);
  return { docTitle: m.docTitle, body: quarterReportModelToPlainText(m) };
}
