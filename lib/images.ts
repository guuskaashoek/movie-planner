import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3, BUCKET_NAME } from "@/lib/s3";
import { isStorageUrl } from "@/lib/storage-url";
import { parsePublicUrl, safeGet, TooLargeError, UnsafeUrlError, type SafeResponse } from "@/lib/safe-fetch";

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
  return isStorageUrl(url, storageBaseUrl());
}

export type ImportedPoster = {
  url: string;
  contentType: string;
  bytes: number;
  reused: boolean;
  body?: Buffer;
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

  // safeGet checks the address at connect time (no DNS rebinding) and caps the body.
  const poster = (err: unknown) =>
    err instanceof UnsafeUrlError
      ? new Error(
          err instanceof TooLargeError
            ? `Image is larger than ${Math.round(MAX_POSTER_BYTES / 1024 / 1024)}MB`
            : `Poster ${err.message}`
        )
      : new Error("Could not download the poster");
  let current: URL;
  try {
    current = parsePublicUrl(trimmed);
  } catch (err) {
    throw poster(err);
  }
  let res: SafeResponse | null = null;

  // Follow redirects by hand so every hop is re-validated against SSRF.
  for (let hop = 0; hop < 4; hop++) {
    try {
      res = await safeGet(current, {
        cap: MAX_POSTER_BYTES,
        headers: {
          // Some CDNs (TMDB, Wikipedia) refuse requests without these.
          "User-Agent": "MoviePlannerBot/1.0 (+poster-import)",
          Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
        },
      });
    } catch (err) {
      throw poster(err);
    }

    if (res.status >= 300 && res.status < 400) {
      if (!res.location) throw new Error("Poster URL redirected without a target");
      try {
        current = parsePublicUrl(new URL(res.location, current).toString());
      } catch (err) {
        throw poster(err);
      }
      res = null;
      continue;
    }
    break;
  }

  if (!res) throw new Error("Poster URL redirected too many times");
  if (res.status < 200 || res.status >= 300 || !res.body) {
    throw new Error("Could not download the poster");
  }

  const body = res.body;
  const kind = sniffImageType(body);
  if (!kind) {
    throw new Error(
      "That URL is not a JPEG, PNG, WebP or AVIF image (it may be an HTML page rather than a direct image link)"
    );
  }

  const url = await storePoster(body, kind);
  return { url, contentType: kind.contentType, bytes: body.length, reused: false, body };
}
