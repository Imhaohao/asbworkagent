import { NextRequest } from "next/server";

/** Mutating routes require x-import-secret matching IMPORT_SECRET when set. */
export function assertImportAuthorized(req: NextRequest): void {
  const secret = process.env.IMPORT_SECRET;
  if (!secret) return;
  const header = req.headers.get("x-import-secret");
  if (header !== secret) {
    throw new Error("Unauthorized");
  }
}

export function importUnauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
