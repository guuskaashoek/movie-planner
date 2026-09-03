import { lookup } from "dns/promises";
import { isIP } from "net";
import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3, BUCKET_NAME } from "@/lib/s3";

export const MAX_POSTER_BYTES = 10 * 1024 * 1024;

export type ImageKind = {
  contentType: "image/jpeg" | "image/png" | "image/webp" | "image/avif";
  ext: "jpg" | "png" | "webp" | "avif";
};

export const ALLOWED_UPLOAD_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
];

/**
 * Identify an image by its magic bytes. Content-Type headers and file
 * extensions both lie, so the bytes decide what we store.
 */
export function sniffImageType(buf: Buffer): ImageKind | null {
  if (buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { contentType: "image/jpeg", ext: "jpg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { contentType: "image/png", ext: "png" };
  }

  // WEBP: "RIFF" .... "WEBP"
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return { contentType: "image/webp", ext: "webp" };
  }

  // AVIF (ISO-BMFF): size, "ftyp", then a brand of avif/avis. Some encoders put
  // the AVIF brand in the compatible-brands list instead of the major brand,
  // so scan the ftyp box for it.
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    const boxSize = buf.readUInt32BE(0);
    const end = Math.min(buf.length, boxSize > 8 ? boxSize : 32);
    const brands = buf.toString("ascii", 8, end);
    if (brands.includes("avif") || brands.includes("avis")) {
      return { contentType: "image/avif", ext: "avif" };
    }
  }

  return null;
}

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
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const addr = ip.toLowerCase().split("%")[0];
  if (addr === "::" || addr === "::1") return true;
  if (addr.startsWith("fc") || addr.startsWith("fd")) return true; // unique local
  if (addr.startsWith("fe80")) return true; // link-local
  // IPv4-mapped (::ffff:a.b.c.d)
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(addr);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true;
}

/**
 * Reject anything that is not a public http(s) host. Without this, a model
 * could ask the server to fetch `http://169.254.169.254/...` and hand back
 * cloud credentials as a "poster".
 */
async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Poster URL is not a valid URL");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Poster URL must use http or https");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");

  if (isIP(host)) {
    if (isPrivateAddress(host)) {
      throw new Error("Poster URL points at a private address");
    }
    return url;
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new Error(`Could not resolve poster host "${host}"`);
  }

  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new Error("Poster URL points at a private address");
  }

  return url;
}

/** Read a response body into a Buffer, aborting past the size cap. */
async function readCapped(res: Response, cap: number): Promise<Buffer> {
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared && declared > cap) {
    throw new Error(`Image is larger than ${Math.round(cap / 1024 / 1024)}MB`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("Image response had no body");

  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel();
      throw new Error(`Image is larger than ${Math.round(cap / 1024 / 1024)}MB`);
    }
    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks);
}

/** Store bytes in the bucket under a flat `<uuid>.<ext>` key and return its URL. */
export async function storePoster(body: Buffer, kind: ImageKind): Promise<string> {
  if (!BUCKET_NAME) {
    throw new Error("Storage bucket is not configured (WASABI_BUCKET_NAME)");
  }

  // Keys must stay flat: signPosterUrl() and the OG image route recover the key
  // with url.split("/").pop().
  const key = `${randomUUID()}.${kind.ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: kind.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return `${storageBaseUrl()}/${key}`;
}

/** The public base URL our own posters are served from. */
export function storageBaseUrl(): string {
  return (
    process.env.WASABI_PUBLIC_BASE ??
    `https://s3.eu-central-1.wasabisys.com/${BUCKET_NAME}`
  ).replace(/\/$/, "");
}

/**
 * True when the URL already points at our own bucket, including a custom
 * WASABI_PUBLIC_BASE domain. Such a URL is stored as-is instead of downloaded.
 */
export function isOwnStorageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (trimmed.includes("wasabisys.com")) return true;
  const base = storageBaseUrl();
  return Boolean(base) && trimmed.startsWith(base);
}

export type ImportedPoster = {
  url: string;
  contentType: string;
  bytes: number;
  reused: boolean;
};

/**
 * Download a poster the model found somewhere on the web and re-host it in our
 * own bucket, so the board never depends on a third-party URL staying alive.
 * URLs that already live in our bucket are kept as-is (signature stripped).
 */
export async function importPosterFromUrl(rawUrl: string): Promise<ImportedPoster> {
  const trimmed = rawUrl.trim();

  // Already ours: store the canonical, unsigned form.
  if (isOwnStorageUrl(trimmed)) {
    const canonical = trimmed.split("?")[0];
    return { url: canonical, contentType: "image/*", bytes: 0, reused: true };
  }

  let current = await assertPublicUrl(trimmed);
  let res: Response | null = null;

  // Follow redirects by hand so every hop is re-validated against SSRF.
  for (let hop = 0; hop < 4; hop++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      res = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          // Some CDNs (TMDB, Wikipedia) refuse requests without these.
          "User-Agent": "MoviePlannerBot/1.0 (+poster-import)",
          Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
        },
      });
    } catch (err) {
      throw new Error(
        `Could not download the poster: ${err instanceof Error ? err.message : "request failed"}`
      );
    } finally {
      clearTimeout(timeout);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("Poster URL redirected without a target");
      current = await assertPublicUrl(new URL(location, current).toString());
      res = null;
      continue;
    }
    break;
  }

  if (!res) throw new Error("Poster URL redirected too many times");
  if (!res.ok) {
    throw new Error(`Poster URL returned HTTP ${res.status}`);
  }

  const body = await readCapped(res, MAX_POSTER_BYTES);
  const kind = sniffImageType(body);
  if (!kind) {
    throw new Error(
      "That URL is not a JPEG, PNG, WebP or AVIF image (it may be an HTML page rather than a direct image link)"
    );
  }

  const url = await storePoster(body, kind);
  return { url, contentType: kind.contentType, bytes: body.length, reused: false };
}
