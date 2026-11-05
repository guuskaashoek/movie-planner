/**
 * Next decodes dynamic route segments itself and answers an invalid
 * percent-escape ("%ff", "%c0%af") with a bare 500 and no log line. Nothing
 * can live behind such a path, so it is simply not found.
 *
 * It also refuses cross-origin browser writes to the session API (see
 * lib/same-origin.ts).
 *
 * Only these routes are matched. /api/upload, /api/mcp and /api/auth stay out
 * on purpose: a proxy makes Next clone the request body, and those routes cap
 * their own bodies (/api/upload runs the same-origin check itself; /api/mcp
 * uses bearer keys, not cookies; Auth.js has its own CSRF token).
 */
import { NextResponse, type NextRequest } from "next/server";
import { isCrossOriginWrite } from "@/lib/same-origin";

export function proxy(req: NextRequest) {
  if (isCrossOriginWrite(req)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  try {
    decodeURIComponent(req.nextUrl.pathname);
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/film/:path*",
    "/invite/:path*",
    "/api/og-image/:path*",
    "/api/films/:path*",
    "/api/admin/:path*",
    "/api/keys/:path*",
  ],
};
