# asbworkagent

Next.js dashboard for Palo Alto ASB (and similar): import **Account Statement** exports from ASBWORKS (the files are HTML tables saved as `.xls`), roll transactions up by **event tag** (Notes / Description), compare **this fiscal year and last** (July 1–June 30), then **push to Google Sheets** or create a **quarterly Google Doc**.

## Setup

1. **Supabase**  
   - Create a project.  
   - Run `supabase/migrations/001_initial.sql` in the SQL editor.

2. **Environment**  
   - Copy `.env.example` to `.env.local`.  
   - Set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (service role stays server-only; never expose it in the browser).

3. **Google (Sheets + Docs)**  
   Do **not** use your Google “password.” Use a **service account**:

   - In [Google Cloud Console](https://console.cloud.google.com/), enable **Google Sheets API** and **Google Drive API**.  
   - Create a service account → download JSON.  
   - Put the JSON string in `GOOGLE_SERVICE_ACCOUNT_JSON` (Vercel: paste the whole JSON as one env var).  
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
