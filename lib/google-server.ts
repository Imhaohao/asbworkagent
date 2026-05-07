import { readFileSync, existsSync } from "fs";
import path from "path";
import { google } from "googleapis";

type ServiceAccountCreds = {
  client_email: string;
  private_key: string;
};

/** Some pastes drop the BEGIN line but keep END; google-auth needs a full PEM. */
function normalizePemPrivateKey(pk: string): string {
  if (pk.includes("BEGIN PRIVATE KEY")) return pk;
  const end = "-----END PRIVATE KEY-----";
  if (!pk.includes(end)) return pk;
  const inner = pk
    .trim()
    .replace(new RegExp(`\\s*${end}[\\s\\S]*$`), "")
    .trim();
  if (!inner) return pk;
  return `-----BEGIN PRIVATE KEY-----\n${inner}\n${end}\n`;
}

/**
 * Loads service account JSON from env. Multi-line JSON in `.env` is often truncated
 * (only the first line is loaded), which causes "Unexpected end of JSON input".
 * Fix: minify to one line, or set GOOGLE_SERVICE_ACCOUNT_JSON_B64 (base64 of the file).
 */
function assertServiceAccountShape(
  parsed: unknown,
  source:
    | "GOOGLE_SERVICE_ACCOUNT_JSON"
    | "GOOGLE_SERVICE_ACCOUNT_JSON_B64"
    | "GOOGLE_SERVICE_ACCOUNT_JSON_FILE",
): ServiceAccountCreds {
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`Service account JSON (${source}) must be an object.`);
  }
  const o = parsed as Record<string, unknown>;
  const client_email = o.client_email;
  const private_key = o.private_key;

  if (typeof client_email !== "string" || !client_email) {
    throw new Error(
      `Service account JSON (${source}) is missing a string "client_email" field.`,
    );
  }
  if (typeof private_key !== "string" || !private_key) {
    throw new Error(
      `Service account JSON (${source}) is missing a string "private_key" field.`,
    );
  }

  return { client_email, private_key: normalizePemPrivateKey(private_key) };
}

/**
 * Handles: UTF-8 BOM, double-encoded JSON string ("{\"type\":...}"),
 * and gives a clear hint when people paste JS-style single-quoted "JSON".
 */
function parseCredentialsJson(raw: string, sourceLabel: string): unknown {
  const s = raw.trim().replace(/^\uFEFF/, "");

  if (s.startsWith("{") && s.length > 1 && s[1] === "'") {
    throw new SyntaxError(
      `${sourceLabel}: use valid JSON with double quotes, not single quotes. ` +
        "Run: node -e \"console.log(JSON.stringify(require('./key.json')))\" and paste that one line.",
    );
  }

  try {
    return JSON.parse(s);
  } catch {
    /* whole value is a JSON string that contains JSON (common when quoting .env) */
    try {
      const once = JSON.parse(s);
      if (typeof once === "string") {
        return JSON.parse(once);
      }
    } catch {
      /* fall through */
    }
    throw new SyntaxError(
      `${sourceLabel}: not valid JSON. First chars: ${JSON.stringify(s.slice(0, 48))}…`,
    );
  }
}

function readCredentialsFile(): string | null {
  const rawPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_FILE?.trim();
  if (!rawPath) return null;
  const absolute = path.isAbsolute(rawPath)
    ? rawPath
    : path.join(process.cwd(), rawPath);
  if (!existsSync(absolute)) {
    throw new Error(
      `GOOGLE_SERVICE_ACCOUNT_JSON_FILE: file not found at ${absolute}`,
    );
  }
  return readFileSync(absolute, "utf8");
}

function loadServiceAccountCreds(): ServiceAccountCreds {
  const fromFile = readCredentialsFile();
  if (fromFile) {
    return assertServiceAccountShape(
      parseCredentialsJson(fromFile, "GOOGLE_SERVICE_ACCOUNT_JSON_FILE"),
      "GOOGLE_SERVICE_ACCOUNT_JSON_FILE",
    );
  }

  const rawPrimary = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  const rawB64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64?.trim();

  if (rawPrimary) {
    try {
      return assertServiceAccountShape(
        parseCredentialsJson(rawPrimary, "GOOGLE_SERVICE_ACCOUNT_JSON"),
        "GOOGLE_SERVICE_ACCOUNT_JSON",
      );
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e;
      /* truncated / invalid JSON — try GOOGLE_SERVICE_ACCOUNT_JSON_B64 */
    }
  }

  if (rawB64) {
    try {
      const decoded = Buffer.from(rawB64, "base64").toString("utf8");
      return assertServiceAccountShape(
        parseCredentialsJson(
          decoded,
          "GOOGLE_SERVICE_ACCOUNT_JSON_B64 (decoded)",
        ),
        "GOOGLE_SERVICE_ACCOUNT_JSON_B64",
      );
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Could not parse base64 credentials";
      throw new Error(`GOOGLE_SERVICE_ACCOUNT_JSON_B64: ${msg}`);
    }
  }

  throw new Error(
    "Invalid Google service account credentials. " +
      "Easiest for local dev: set GOOGLE_SERVICE_ACCOUNT_JSON_FILE=/absolute/or/relative/path/to/key.json " +
      "(the file Google gives you—do not commit it). " +
      "Or use GOOGLE_SERVICE_ACCOUNT_JSON as one minified line, or GOOGLE_SERVICE_ACCOUNT_JSON_B64. " +
      '"Unexpected end of JSON input" means the JSON in .env was cut off or quoted wrong.',
  );
}

function getJwtClient(scopes: string[]) {
  const creds = loadServiceAccountCreds();
  return new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes,
  });
}

/**
 * Sheet portion of A1 notation, e.g. `Summary!A1` → `Summary`, `'Q1 Data'!A1` → `Q1 Data`.
 * Returns null when there is no `Sheet!` prefix (e.g. `A1`).
 */
export function sheetTitleFromA1Range(a1Range: string): string | null {
  const trimmed = a1Range.trim();
  const bang = trimmed.indexOf("!");
  if (bang === -1) return null;
  let raw = trimmed.slice(0, bang);
  if (raw.startsWith("'")) {
    if (!raw.endsWith("'")) return null;
    raw = raw.slice(1, -1).replace(/''/g, "'");
  }
  const title = raw.trim();
  return title || null;
}

export async function ensureSheetTabExists(
  sheetsAPI: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  sheetTitle: string,
) {
  const { data } = await sheetsAPI.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  const titles =
    data.sheets
      ?.map((s) => s.properties?.title)
      .filter((t): t is string => typeof t === "string") ?? [];
  if (titles.includes(sheetTitle)) return;
  await sheetsAPI.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: sheetTitle } } }],
    },
  });
}

/** Overwrite a rectangular range (e.g. `'Summary'!A1'`). Creates the sheet tab if missing. */
export async function writeSheetRange(
  spreadsheetId: string,
  range: string,
  values: string[][],
) {
  const auth = getJwtClient(["https://www.googleapis.com/auth/spreadsheets"]);
  const sheetsAPI = google.sheets({ version: "v4", auth });
  const sheetTitle = sheetTitleFromA1Range(range);
  if (sheetTitle) {
    await ensureSheetTabExists(sheetsAPI, spreadsheetId, sheetTitle);
  }
  await sheetsAPI.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

/** Authenticated Sheets API client (spreadsheets scope). */
export function createSheetsClient() {
  const auth = getJwtClient(["https://www.googleapis.com/auth/spreadsheets"]);
  return google.sheets({ version: "v4", auth });
}

export async function createTextDoc(title: string, bodyText: string): Promise<string> {
  const auth = getJwtClient([
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive.file",
  ]);
  const docs = google.docs({ version: "v1", auth });
  const drive = google.drive({ version: "v3", auth });

  const created = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: "application/vnd.google-apps.document",
    },
    fields: "id",
  });
  const docId = created.data.id;
  if (!docId) throw new Error("Failed to create Google Doc");

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [{ insertText: { location: { index: 1 }, text: bodyText } }],
    },
  });

  return `https://docs.google.com/document/d/${docId}/edit`;
}
