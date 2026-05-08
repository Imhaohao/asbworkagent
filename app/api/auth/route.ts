import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { code } = await req.json();
  const adminCode = process.env.ACCESS_CODE;
  const journalistCode = process.env.JOURNALIST_CODE ?? "TransparentASB";

  let role: string | null = null;
  if (adminCode && code === adminCode) {
    role = "admin";
  } else if (code === journalistCode) {
    role = "journalist";
  }

  if (!role) {
    return NextResponse.json({ error: "Invalid access code" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, role });
  res.cookies.set("access_role", role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
