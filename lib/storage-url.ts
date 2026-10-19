/**
 * True when `url` points at our bucket: an https Wasabi host (path or
 * virtual-host style) or the custom public base. A substring match is not
 * enough, since `https://evil.example/wasabisys.com` contains the name too.
 */
export function isStorageUrl(url: string | null | undefined, publicBase?: string | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) return false;
  const host = parsed.hostname.toLowerCase();
  if (host === "wasabisys.com" || host.endsWith(".wasabisys.com")) return true;
  const base = publicBase?.replace(/\/$/, "");
  return Boolean(base) && trimmed.startsWith(`${base}/`);
}

/** The bucket key of a stored image: the last path segment, without query. */
export function storageKey(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.split("?")[0].split("/").pop() || null;
}
