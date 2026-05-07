import type { sheets_v4 } from "googleapis";
import type { EventRollup } from "./aggregate";
import { fiscalYearLabel } from "./fiscal";
import {
  createSheetsClient,
  ensureSheetTabExists,
  sheetTitleFromA1Range,
} from "./google-server";

const COLS = 8;
const FINALIZED_COL = 7;

/** Row key safe for arbitrary event text (tab-separated). */
export function summaryRowKey(accountCode: string, eventKey: string): string {
  return `${accountCode}\t${eventKey}`;
}

function parseRowKey(key: string): { accountCode: string; eventKey: string } {
  const tab = key.indexOf("\t");
  if (tab === -1) return { accountCode: key, eventKey: "" };
  return { accountCode: key.slice(0, tab), eventKey: key.slice(tab + 1) };
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function defaultSummaryHeaders(
  fyPrevious: number,
  fyCurrent: number,
): string[] {
  return [
    "Account",
    "Event / tag",
    `Last FY spending (${fiscalYearLabel(fyPrevious)})`,
    `This FY spending — actual (${fiscalYearLabel(fyCurrent)})`,
    "Δ vs last FY (spending)",
    `Scholarship net (${fiscalYearLabel(fyCurrent)})`,
    `Ticket-like receipts (${fiscalYearLabel(fyCurrent)})`,
    "Finalized cost",
  ];
}

function escapeSheetTitleForA1(title: string): string {
  if (!/[^\w]/.test(title)) return title;
  return `'${title.replace(/'/g, "''")}'`;
}

/** Merge rollups into comparison rows; preserve user “Finalized cost” cells. */
export function buildSummarySheetMatrix(
  rollups: EventRollup[],
  fyCurrent: number,
  fyPrevious: number,
  preservedFinalized: Map<string, string>,
  headerRow: string[],
): (string | number)[][] {
  const prev = new Map<string, EventRollup>();
  const curr = new Map<string, EventRollup>();
  for (const r of rollups) {
    const k = summaryRowKey(r.accountCode, r.eventKey);
    if (r.fiscalYearStart === fyPrevious) prev.set(k, r);
    if (r.fiscalYearStart === fyCurrent) curr.set(k, r);
  }
  const keys = new Set<string>([...prev.keys(), ...curr.keys()]);
  const sorted = [...keys].sort((a, b) => {
    const A = parseRowKey(a);
    const B = parseRowKey(b);
    const ac = A.accountCode.localeCompare(B.accountCode);
    if (ac !== 0) return ac;
    return A.eventKey.localeCompare(B.eventKey, undefined, {
      sensitivity: "base",
    });
  });

  const rows: (string | number)[][] = [headerRow];
  for (const k of sorted) {
    const { accountCode, eventKey } = parseRowKey(k);
    const p = prev.get(k);
    const c = curr.get(k);
    const lastOut = roundMoney(p?.outflow ?? 0);
    const thisOut = roundMoney(c?.outflow ?? 0);
    const delta = roundMoney(thisOut - lastOut);
    const schol = roundMoney(c?.scholarshipNet ?? 0);
    const tickets = c?.ticketLikeCount ?? 0;
    const fin = preservedFinalized.get(k) ?? "";
    rows.push([
      accountCode,
      eventKey,
      lastOut,
      thisOut,
      delta,
      schol,
      tickets,
      fin,
    ]);
  }
  return rows;
}

/** Pull finalized column from an existing Summary grid (same 8-column layout). */
export function finalizedMapFromExistingRows(
  valueRows: string[][] | null | undefined,
): Map<string, string> {
  const m = new Map<string, string>();
  if (!valueRows) return m;
  for (const row of valueRows) {
    if (row.length < FINALIZED_COL + 1) continue;
    const account = String(row[0] ?? "").trim();
    const event = String(row[1] ?? "").trim();
    const fin = row[FINALIZED_COL];
    if (!account && !event) continue;
    const raw = fin == null ? "" : String(fin).trim();
    if (raw !== "") m.set(summaryRowKey(account, event), raw);
  }
  return m;
}

const HDR_BG: sheets_v4.Schema$Color = {
  red: 68 / 255,
  green: 114 / 255,
  blue: 196 / 255,
};
const HDR_FG: sheets_v4.Schema$Color = { red: 1, green: 1, blue: 1 };

/** Match typical “Sheet Example” treasurer cues: blue header, new / higher / lower vs last FY. */
const CF_NEW: sheets_v4.Schema$Color = { red: 0.87, green: 0.92, blue: 0.97 };
const CF_HIGHER: sheets_v4.Schema$Color = { red: 0.99, green: 0.91, blue: 0.85 };
const CF_LOWER: sheets_v4.Schema$Color = { red: 0.89, green: 0.94, blue: 0.86 };

async function fetchTemplateHeaders(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
): Promise<string[] | null> {
  const tab =
    process.env.GOOGLE_SHEETS_TEMPLATE_TAB?.trim() || "Sheet Example";
  const range = `${escapeSheetTitleForA1(tab)}!A1:H1`;
  try {
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    const row = data.values?.[0];
    if (!row || row.length < 4) return null;
    const out = [...row.map((c) => String(c ?? "").trim())];
    while (out.length < COLS) out.push("");
    return out.slice(0, COLS);
  } catch {
    return null;
  }
}

async function getTargetSheetId(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  title: string,
): Promise<number> {
  const { data } = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const sheetId = data.sheets
    ?.map((s) => ({
      id: s.properties?.sheetId,
      t: s.properties?.title,
    }))
    .find((x) => x.t === title)?.id;
  if (sheetId == null) {
    throw new Error(`Sheet tab "${title}" not found on spreadsheet`);
  }
  return sheetId;
}

export async function syncFormattedSummarySheet(options: {
  spreadsheetId: string;
  targetRangeEnv: string;
  rollups: EventRollup[];
  fyCurrent: number;
  fyPrevious: number;
}): Promise<{ updatedRange: string; rowCount: number }> {
  const { spreadsheetId, targetRangeEnv, rollups, fyCurrent, fyPrevious } =
    options;

  const targetTitle = sheetTitleFromA1Range(targetRangeEnv);
  if (!targetTitle) {
    throw new Error(
      "GOOGLE_SHEETS_RANGE must include a tab name, e.g. Summary!A1",
    );
  }

  const sheets = createSheetsClient();
  await ensureSheetTabExists(sheets, spreadsheetId, targetTitle);

  const sheetId = await getTargetSheetId(sheets, spreadsheetId, targetTitle);

  const { data: meta } = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties,conditionalFormats)",
  });
  const thisSheet = meta.sheets?.find(
    (s) => s.properties?.title === targetTitle,
  );
  const cfCount = thisSheet?.conditionalFormats?.length ?? 0;
  const deleteCfRequests: sheets_v4.Schema$Request[] = [];
  for (let i = cfCount - 1; i >= 0; i--) {
    deleteCfRequests.push({
      deleteConditionalFormatRule: { sheetId, index: i },
    });
  }

  const existingRange = `${escapeSheetTitleForA1(targetTitle)}!A2:${String.fromCharCode(64 + COLS)}5000`;
  const { data: existingVals } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: existingRange,
  });
  const preserved = finalizedMapFromExistingRows(existingVals.values as string[][] | undefined);

  let headers =
    (await fetchTemplateHeaders(sheets, spreadsheetId)) ??
    defaultSummaryHeaders(fyPrevious, fyCurrent);

  if (headers.length < COLS) {
    headers = defaultSummaryHeaders(fyPrevious, fyCurrent);
  } else {
    headers = headers.slice(0, COLS);
    while (headers.length < COLS) headers.push("");
  }
  headers[FINALIZED_COL] = headers[FINALIZED_COL] || "Finalized cost";

  const matrix = buildSummarySheetMatrix(
    rollups,
    fyCurrent,
    fyPrevious,
    preserved,
    headers,
  );

  const numRows = matrix.length;
  const lastColLetter = String.fromCharCode(64 + COLS);
  const writeRange = `${escapeSheetTitleForA1(targetTitle)}!A1:${lastColLetter}${numRows}`;

  if (deleteCfRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: deleteCfRequests },
    });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: writeRange,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: matrix },
  });

  const dataRowCount = numRows - 1;
  const endDataRow = 1 + dataRowCount;

  const formatRequests: sheets_v4.Schema$Request[] = [
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount: 1 },
        },
        fields: "gridProperties.frozenRowCount",
      },
    },
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: COLS,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: HDR_BG,
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
            wrapStrategy: "WRAP",
            textFormat: {
              foregroundColor: HDR_FG,
              bold: true,
              fontSize: 10,
            },
          },
        },
        fields:
          "userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat)",
      },
    },
  ];

  if (dataRowCount > 0) {
    formatRequests.push(
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 1,
            endRowIndex: endDataRow,
            startColumnIndex: 2,
            endColumnIndex: 6,
          },
          cell: {
            userEnteredFormat: {
              numberFormat: {
                type: "CURRENCY",
                pattern: "$#,##0.00",
              },
            },
          },
          fields: "userEnteredFormat.numberFormat",
        },
      },
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 1,
            endRowIndex: endDataRow,
            startColumnIndex: 0,
            endColumnIndex: 2,
          },
          cell: {
            userEnteredFormat: {
              horizontalAlignment: "LEFT",
              verticalAlignment: "MIDDLE",
            },
          },
          fields:
            "userEnteredFormat(horizontalAlignment,verticalAlignment)",
        },
      },
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 1,
            endRowIndex: endDataRow,
            startColumnIndex: 6,
            endColumnIndex: 7,
          },
          cell: {
            userEnteredFormat: {
              horizontalAlignment: "RIGHT",
              numberFormat: { type: "NUMBER", pattern: "0" },
            },
          },
          fields:
            "userEnteredFormat(horizontalAlignment,numberFormat)",
        },
      },
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 1,
            endRowIndex: endDataRow,
            startColumnIndex: FINALIZED_COL,
            endColumnIndex: COLS,
          },
          cell: {
            userEnteredFormat: {
              horizontalAlignment: "RIGHT",
              verticalAlignment: "MIDDLE",
              textFormat: { italic: true },
            },
          },
          fields:
            "userEnteredFormat(horizontalAlignment,verticalAlignment,textFormat)",
        },
      },
      {
        addConditionalFormatRule: {
          rule: {
            ranges: [
              {
                sheetId,
                startRowIndex: 1,
                endRowIndex: endDataRow,
                startColumnIndex: 0,
                endColumnIndex: COLS,
              },
            ],
            booleanRule: {
              condition: {
                type: "CUSTOM_FORMULA",
                values: [{ userEnteredValue: "=AND($C2=0,$D2>0)" }],
              },
              format: { backgroundColor: CF_NEW },
            },
          },
        },
      },
      {
        addConditionalFormatRule: {
          rule: {
            ranges: [
              {
                sheetId,
                startRowIndex: 1,
                endRowIndex: endDataRow,
                startColumnIndex: 0,
                endColumnIndex: COLS,
              },
            ],
            booleanRule: {
              condition: {
                type: "CUSTOM_FORMULA",
                values: [{ userEnteredValue: "=AND($C2>0,$D2>$C2)" }],
              },
              format: { backgroundColor: CF_HIGHER },
            },
          },
        },
      },
      {
        addConditionalFormatRule: {
          rule: {
            ranges: [
              {
                sheetId,
                startRowIndex: 1,
                endRowIndex: endDataRow,
                startColumnIndex: 0,
                endColumnIndex: COLS,
              },
            ],
            booleanRule: {
              condition: {
                type: "CUSTOM_FORMULA",
                values: [{ userEnteredValue: "=AND($C2>0,$D2>0,$D2<$C2)" }],
              },
              format: { backgroundColor: CF_LOWER },
            },
          },
        },
      },
    );
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: formatRequests },
  });

  return { updatedRange: writeRange, rowCount: numRows };
}
