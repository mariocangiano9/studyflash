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

  const isProd = process.env.NODE_ENV === "production";
  const host = request.headers.get("host") || "";
  const isStudyflashDomain = host.endsWith("studyflash.net");

  const response = NextResponse.json({
    ok: true,
    redirect: isStudyflashDomain ? "https://www.studyflash.net/" : "/",
  });
  response.cookies.set("auth", "authenticated", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
    // Punto davanti: il cookie vale per studyflash.net e www.studyflash.net
    ...(isStudyflashDomain ? { domain: ".studyflash.net" } : {}),
  });

  return response;
}
