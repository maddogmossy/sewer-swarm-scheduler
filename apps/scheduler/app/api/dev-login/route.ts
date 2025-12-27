import { NextResponse } from "next/server";

export async function POST() {
  const userId = "dev-user-1";

  const res = NextResponse.json({ ok: true });

  res.cookies.set("userId", userId, {
    httpOnly: true,
    path: "/",
  });

  return res;
}
