import type { EventRollup } from "./aggregate";

type GroupRule = { group: string; test: (key: string) => boolean };

const RULES: GroupRule[] = [
  { group: "Prom", test: (k) => /prom/i.test(k) },
  { group: "Homecoming", test: (k) => /homecoming|hoco/i.test(k) },
  { group: "Spirit Week", test: (k) => /spirit\s*week/i.test(k) },
  { group: "Rallies", test: (k) => /\brall(y|ies)\b/i.test(k) },
  { group: "Socials", test: (k) => /social/i.test(k) },
  { group: "Coldplay Parking", test: (k) => /coldplay/i.test(k) },
];

function groupNameFor(eventKey: string | null | undefined): string {
  const key = String(eventKey ?? "").trim();
  if (/^balance\s*forward$/i.test(key)) return "Balance Forward";
  for (const rule of RULES) {
    if (rule.test(key)) return rule.group;
  }
  return key || "(Uncategorized)";
}

export type GroupedCategory = {
  group: string;
  currentInflow: number;
  currentOutflow: number;
  currentNet: number;
  currentTxns: number;
  previousInflow: number;
  previousOutflow: number;
  previousNet: number;
  previousTxns: number;
  subEvents: string[];
};

export type ManualGroupEntry = {
  account_code: string;
  event_key: string;
  group_name: string | null;
};

export function groupRollups(
  current: EventRollup[],
  previous: EventRollup[],
  manualGroups?: ManualGroupEntry[],
): GroupedCategory[] {
  const manualMap = new Map<string, string>();
  if (manualGroups) {
    for (const m of manualGroups) {
      if (m.group_name) {
        manualMap.set(`${m.account_code}|${m.event_key}`, m.group_name);
      }
    }
  }

  const resolveGroup = (accountCode: string, eventKey: string): string => {
    const manual = manualMap.get(`${accountCode}|${eventKey}`);
    if (manual) return manual;
    return groupNameFor(eventKey);
  };

  const map = new Map<string, GroupedCategory>();

  const ensure = (group: string): GroupedCategory => {
    let g = map.get(group);
    if (!g) {
      g = {
        group,
        currentInflow: 0,
        currentOutflow: 0,
        currentNet: 0,
        currentTxns: 0,
        previousInflow: 0,
        previousOutflow: 0,
        previousNet: 0,
        previousTxns: 0,
        subEvents: [],
      };
      map.set(group, g);
    }
    return g;
  };

  for (const r of current) {
    const group = resolveGroup(r.accountCode, r.eventKey);
    const g = ensure(group);
    g.currentInflow += r.inflow;
    g.currentOutflow += r.outflow;
    g.currentNet += r.net;
    g.currentTxns += r.txnCount;
    if (!g.subEvents.includes(r.eventKey)) g.subEvents.push(r.eventKey);
  }

  for (const r of previous) {
    const group = resolveGroup(r.accountCode, r.eventKey);
    const g = ensure(group);
    g.previousInflow += r.inflow;
    g.previousOutflow += r.outflow;
    g.previousNet += r.net;
    g.previousTxns += r.txnCount;
    if (!g.subEvents.includes(r.eventKey)) g.subEvents.push(r.eventKey);
  }

  return [...map.values()].sort((a, b) => {
    const aCost = Math.max(a.currentOutflow, a.currentInflow);
    const bCost = Math.max(b.currentOutflow, b.currentInflow);
    return bCost - aCost;
  });
}
