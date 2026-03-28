import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { pin } = await request.json();
  const correctPin = process.env.SITE_PIN;

  if (!correctPin) {
    return NextResponse.json({ error: "PIN non configurato" }, { status: 500 });
  }

  if (pin !== correctPin) {
    return NextResponse.json({ error: "PIN errato" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("auth", "authenticated", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });

  return response;
}
