/**
 * HTTP response headers (e.g. Content-Disposition `filename=`) must be ByteString /
 * Latin-1 safe. Titles use en-dash U+2013 (e.g. 2025–26) which triggers:
 * "Cannot convert argument to a ByteString because the character … 8212 … > 255".
 */
export function quarterReportDownloadBasename(docTitle: string): string {
  const ascii = docTitle
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/[\s\\/:*?"<>|]+/g, "_")
    .replace(/_+/g, "_")
    .trim()
    .slice(0, 100);
  return ascii || "quarter-report";
}
