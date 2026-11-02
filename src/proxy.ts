import { NextResponse, type NextRequest } from "next/server";
import { canAccess } from "@/domain/access";
import { SESSION_COOKIE, verifySession } from "@/server/session";

// Optimistic page guard. Server actions re-check with requireRole().
export async function proxy(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (canAccess(session?.role ?? null, req.nextUrl.pathname)) return NextResponse.next();
  const login = new URL("/login", req.url);
  login.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/staff", "/staff/:path*", "/gm", "/gm/:path*"] };
