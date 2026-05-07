# asbworkagent

Next.js dashboard for Palo Alto ASB (and similar): import **Account Statement** exports from ASBWORKS (the files are HTML tables saved as `.xls`), roll transactions up by **event tag** (Notes / Description), compare **this fiscal year and last** (July 1–June 30), then **push to Google Sheets** or create a **quarterly Google Doc**.

## Setup

1. **Supabase**  
   - Create a project.  
   - Run `supabase/migrations/001_initial.sql` in the SQL editor.

2. **Environment**  
   - Create `.env.local` at the project root (not committed).  
   - Set `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and optionally `IMPORT_SECRET`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SPREADSHEET_ID`, `GOOGLE_SHEETS_RANGE` (see Google section).

3. **Google (Sheets + Docs)**  
   Do **not** use your Google “password.” Use a **service account**:

   - In [Google Cloud Console](https://console.cloud.google.com/), enable **Google Sheets API** and **Google Drive API**.  
   - Create a service account → download JSON.  
   - **Recommended locally:** put the file somewhere **outside** the repo (e.g. `~/keys/asb-sa.json`) and in `.env.local`:  
     `GOOGLE_SERVICE_ACCOUNT_JSON_FILE=/Users/you/keys/asb-sa.json`  
     (relative paths are resolved from the project root.) **Do not commit** the key file.  
   - **Or** one minified line:  
     `node -e "console.log(JSON.stringify(require('./your-key.json')))"` → `GOOGLE_SERVICE_ACCOUNT_JSON=...`  
     Multi-line JSON in `.env` often **truncates**.  
   - **Or** base64 (no newline): `base64 -i your-key.json | tr -d '\n'` → `GOOGLE_SERVICE_ACCOUNT_JSON_B64`.  
   - On **Vercel**, use the single-line JSON or `GOOGLE_SERVICE_ACCOUNT_JSON_B64` (file path is not available there).  
   - **Share** your spreadsheet with the service account email (`…@….iam.gserviceaccount.com`) as **Editor**.  
   - Create a tab named `Summary` (or set `GOOGLE_SHEETS_RANGE` to your range).

4. **Optional: lock write APIs**  
   Set `IMPORT_SECRET`. Clients must send header `x-import-secret: <same value>` for import and Google sync routes.

## Usage

- `npm run dev` — open the dashboard, choose account filter, upload `.xls` from ASBWORKS.  
- **Push summary → Google Sheet** overwrites `GOOGLE_SHEETS_RANGE` with current + prior fiscal year rollups.  
- **Quarterly Google Doc** builds plain-text summary for the chosen fiscal year start + quarter (Q1 = Jul–Sep of that FY start year).

## Event / “Prom tickets” logic

- **Event bucket** = Notes if present, else Description (same pattern as your Dance export).  
- **Scholarship** = lines where the combined Description + Notes contains “scholarship” (case-insensitive).  
- **Ticket-like** = count of **RECEIPT** rows with **positive** amount (handles web-store ticket batches; adjust logic later if you need exact headcount rules).

## Deploy (Vercel)

Add the same env vars. Upgrade `next` if your CLI warns about security advisories.

## License

See [LICENSE](LICENSE).
