import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") || "";

  // Force www redirect in production
  if (
    host === "studyflash.net" &&
    !pathname.startsWith("/_next")
  ) {
    const url = request.nextUrl.clone();
    url.host = "www.studyflash.net";
    return NextResponse.redirect(url, 308);
  }

  // Skip login page, login API, and static assets
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const auth = request.cookies.get("auth");
  if (!auth || auth.value !== "authenticated") {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
