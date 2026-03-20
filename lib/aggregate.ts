import { fiscalYearLabel } from "./fiscal";

export type EventRollup = {
  accountCode: string;
  eventKey: string;
  fiscalYearStart: number;
  fiscalYearDisplay: string;
  inflow: number;
  outflow: number;
  net: number;
  txnCount: number;
  receiptCount: number;
  scholarshipNet: number;
  ticketLikeCount: number;
};

export type TxnForRollup = {
  accountCode: string;
  eventKey: string;
  fiscalYearStart: number;
  amount: number;
  txnType: string;
  description: string;
  notes: string;
};

export function rollupEvents(rows: TxnForRollup[]): EventRollup[] {
  const map = new Map<string, EventRollup>();

  for (const r of rows) {
    const key = `${r.accountCode}|${r.fiscalYearStart}|${r.eventKey}`;
    let agg = map.get(key);
    if (!agg) {
      agg = {
        accountCode: r.accountCode,
        eventKey: r.eventKey,
        fiscalYearStart: r.fiscalYearStart,
        fiscalYearDisplay: fiscalYearLabel(r.fiscalYearStart),
        inflow: 0,
        outflow: 0,
        net: 0,
        txnCount: 0,
        receiptCount: 0,
        scholarshipNet: 0,
        ticketLikeCount: 0,
      };
      map.set(key, agg);
    }

    agg.txnCount += 1;
    agg.net += r.amount;
    if (r.amount > 0) agg.inflow += r.amount;
    if (r.amount < 0) agg.outflow += -r.amount;

    if (r.txnType.toUpperCase() === "RECEIPT") {
      agg.receiptCount += 1;
      if (r.amount > 0) agg.ticketLikeCount += 1;
    }

    const blob = `${r.description} ${r.notes}`.toLowerCase();
    if (blob.includes("scholarship")) {
      agg.scholarshipNet += r.amount;
    }
  }

  return [...map.values()].sort((a, b) => {
    const ac = a.accountCode.localeCompare(b.accountCode);
    if (ac !== 0) return ac;
    return a.eventKey.localeCompare(b.eventKey, undefined, {
      sensitivity: "base",
    });
  });
}
