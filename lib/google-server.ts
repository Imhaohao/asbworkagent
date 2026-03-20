import { google } from "googleapis";

function getJwtClient(scopes: string[]) {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("Set GOOGLE_SERVICE_ACCOUNT_JSON to your service account JSON");
  }
  const creds = JSON.parse(raw) as {
    client_email: string;
    private_key: string;
  };
  return new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes,
  });
}

/** Overwrite a rectangular range (e.g. `'Summary'!A1'`). */
export async function writeSheetRange(
  spreadsheetId: string,
  range: string,
  values: string[][],
) {
  const auth = getJwtClient(["https://www.googleapis.com/auth/spreadsheets"]);
  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
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
