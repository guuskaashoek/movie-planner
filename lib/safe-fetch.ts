/**
 * Fetching a user-supplied URL without reaching our own network.
 *
 * Checking the DNS answer first and then calling fetch() resolves the name
 * twice, so a host with a short TTL can answer with a public address for the
 * check and 127.0.0.1 for the connection (DNS rebinding). Here the check runs
 * inside the socket's own lookup: the address that is checked is the address
 * that is connected to.
 *
 * Pure Node (no @/ imports) so tests can load it directly.
 */
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { isIP, type LookupFunction } from "node:net";
import http from "node:http";
import https from "node:https";

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // "this" network
  if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 192 && b === 0) return true; // 192.0.0.0/24
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const addr = ip.toLowerCase().split("%")[0];
  if (addr === "::" || addr === "::1") return true;
  if (addr.startsWith("fc") || addr.startsWith("fd")) return true; // unique local
  if (/^fe[89ab]/.test(addr)) return true; // link-local
  if (addr.startsWith("ff")) return true; // multicast
  // IPv4-mapped (::ffff:a.b.c.d)
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(addr);
  if (mapped) return isPrivateIPv4(mapped[1]);
  // The URL parser rewrites [::ffff:127.0.0.1] to the hex form [::ffff:7f00:1].
  const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(addr);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    return isPrivateIPv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  // NAT64 and the deprecated IPv4-compatible form can also reach IPv4 hosts.
  if (addr.startsWith("64:ff9b:") || /^::[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(addr)) return true;
  return false;
}

export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true;
}


/** Thrown for anything the caller may show to the user as-is. */
export class UnsafeUrlError extends Error {}

/**
 * socket lookup that refuses private answers. Every address of the answer must
 * be public, so a mixed answer can't be raced to the private one.
 */
export const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses: LookupAddress[]) => {
    if (err) return callback(err, "", 0);
    if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
      return callback(new UnsafeUrlError("URL points at a private address"), "", 0);
    }
    if (options.all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
};

/** Parse and check the scheme and a literal IP host; names are checked at connect time. */
export function parsePublicUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("URL is not a valid URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new UnsafeUrlError("URL must use http or https");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("URL may not contain credentials");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && isPrivateAddress(host)) {
    throw new UnsafeUrlError("URL points at a private address");
  }
  return url;
}

export type SafeResponse = {
  status: number;
  location: string | null;
  /** Body up to `cap` bytes; null for redirects. */
  body: Buffer | null;
};

/** Error with a size cap the caller can report. */
export class TooLargeError extends UnsafeUrlError {}

/** One GET (no redirect following) to a public address, body capped at `cap` bytes. */
export function safeGet(
  url: URL,
  { cap, timeoutMs = 20000, headers = {} }: { cap: number; timeoutMs?: number; headers?: Record<string, string> }
): Promise<SafeResponse> {
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.get(
      url,
      { headers, lookup: publicOnlyLookup, timeout: timeoutMs, agent: false },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, location: res.headers.location ?? null, body: null });
        }
        const declared = Number(res.headers["content-length"] ?? "0");
        if (declared && declared > cap) {
          res.destroy();
          return reject(new TooLargeError("Response is too large"));
        }
        const chunks: Buffer[] = [];
        let total = 0;
        res.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > cap) {
            res.destroy();
            req.destroy();
            return reject(new TooLargeError("Response is too large"));
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ status, location: null, body: Buffer.concat(chunks) }));
        res.on("error", reject);
      }
    );
    req.on("timeout", () => req.destroy(new Error("request timed out")));
    req.on("error", reject);
  });
}
