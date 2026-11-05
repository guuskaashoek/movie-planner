/**
 * Refuse browser writes that come from another origin.
 *
 * The Auth.js session cookie is SameSite=Lax, and Lax only stops *cross-site*
 * requests. guuss.com, math.guuss.com and game.guuss.com are other apps on the
 * same site, so a bug in any of them could POST/PUT/DELETE to this API with the
 * visitor's session attached. Route handlers (unlike server actions) don't
 * check the Origin themselves, so this does.
 *
 * Non-browser clients send neither Sec-Fetch-Site nor Origin and pass; they
 * have no session cookie to abuse anyway.
 */
export function isCrossOriginWrite(req: Request): boolean {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;

  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return true;

  const origin = req.headers.get("origin");
  if (origin === null) return false;
  const host = req.headers.get("host");
  try {
    return !host || new URL(origin).host !== host;
  } catch {
    // "null" (sandboxed iframes, data: URLs) or garbage.
    return true;
  }
}
