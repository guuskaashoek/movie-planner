/**
 * Next decodes dynamic route segments itself and answers an invalid
 * percent-escape ("%ff", "%c0%af") with a bare 500 and no log line. Nothing
 * can live behind such a path, so it is simply not found.
 *
 * Only the routes with dynamic segments are matched. /api/upload, /api/mcp
 * and /api/auth stay out on purpose: a proxy makes Next clone the request
 * body, and those routes cap their own bodies.
 */
import { NextResponse, type NextRequest } from "next/server";

export function proxy(req: NextRequest) {
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
