import { load } from "cheerio";
import { createHash } from "crypto";
import { fiscalYearStart } from "./fiscal";

export type ParsedMeta = {
  accountName: string;
  accountCode: string;
};

export type ParsedRow = {
  txnDate: Date;
  refNumber: string;
  txnType: string;
  description: string;
  payeeName: string;
  notes: string;
  amount: number;
  balance: number | null;
  eventKey: string;
  fiscalYearStart: number;
  contentHash: string;
};

const TITLE_RE =
  /Account Statement Report\s*-\s*(.+?)\s*\((\d+)\)/i;

export function parseAccountStatementHtml(
  html: string,
  filename?: string,
): { meta: ParsedMeta; rows: ParsedRow[] } {
  const $ = load(html);
  const titleText = $("title").first().text().replace(/\s+/g, " ").trim();
  let accountName = "Unknown";
  let accountCode = "0000";
  const m = titleText.match(TITLE_RE);
  if (m) {
    accountName = m[1].trim();
    accountCode = m[2].trim();
  }

  const rows: ParsedRow[] = [];
  $("table tr").each((_, tr) => {
    const cells = $(tr)
      .find("td")
      .map((__, td) => $(td).text().replace(/\s+/g, " ").trim())
      .get();
    if (cells.length < 8) return;
    const [d, num, type, desc, name, notes, amtRaw, balRaw] = cells;
    if (d === "Date" || !d || !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(d)) return;

    const txnDate = parseUsDate(d);
    if (Number.isNaN(+txnDate)) return;

    const amount = parseMoney(amtRaw);
    const balance = balRaw ? parseMoney(balRaw) : null;
    const eventKey = deriveEventKey(desc, notes);
    const fy = fiscalYearStart(txnDate);

    const contentHash = contentHashFor({
      accountCode,
      refNumber: num,
      txnDate: d,
      txnType: type,
      description: desc,
      payeeName: name,
      notes,
      amount,
    });

    rows.push({
      txnDate,
      refNumber: num,
      txnType: type,
      description: desc,
      payeeName: name,
      notes,
      amount,
      balance,
      eventKey,
      fiscalYearStart: fy,
      contentHash,
    });
  });

  void filename;
  return { meta: { accountName, accountCode }, rows };
}

function parseUsDate(s: string): Date {
  const [mm, dd, y] = s.split("/").map((x) => parseInt(x, 10));
  return new Date(y, mm - 1, dd);
}

function parseMoney(s: string): number {
  const n = parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function deriveEventKey(description: string, notes: string): string {
  const n = notes.trim();
  const d = description.trim();
  const primary = n || d || "(Uncategorized)";
  return primary.replace(/\s+/g, " ");
}

function contentHashFor(parts: {
  accountCode: string;
  refNumber: string;
  txnDate: string;
  txnType: string;
  description: string;
  payeeName: string;
  notes: string;
  amount: number;
}): string {
  const payload = [
    parts.accountCode,
    parts.refNumber,
    parts.txnDate,
    parts.txnType,
    parts.description,
    parts.payeeName,
    parts.notes,
    parts.amount.toFixed(4),
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}
