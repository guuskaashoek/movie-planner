import jsQR from "jsqr";
import QRCode from "qrcode";
import sharp from "sharp";

const MAX_PAYLOAD = 2048;

/**
 * A ticket photo is at most 10 MB as a file, but a file that small can still
 * declare enormous dimensions: a blank 16000 x 16000 PNG is under 1 MB and
 * unpacks to 1 GB of pixels. Scanning that sixteen times took 27 seconds and
 * 4.7 GB of memory. Phone photos stay well under this limit; anything larger
 * is simply not scanned (the ticket is still stored, without a redrawn QR).
 */
const MAX_INPUT_PIXELS = 50_000_000;
/** Longest side of the copy that is actually scanned. A QR is readable far below this. */
const SCAN_SIDE = 2400;

type Raw = { data: Buffer; width: number; height: number };

/** Decode the photo once, bounded, into the small RGBA copy every scan pass works from. */
async function loadScanCopy(image: Buffer): Promise<Raw | null> {
  try {
    const { data, info } = await sharp(image, { limitInputPixels: MAX_INPUT_PIXELS })
      .ensureAlpha()
      .resize({ width: SCAN_SIDE, height: SCAN_SIDE, fit: "inside", withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    // Not decodable, or larger than MAX_INPUT_PIXELS.
    return null;
  }
}

async function tryDecode(copy: Raw, width: number, rotate: number) {
  const image = sharp(copy.data, { raw: { width: copy.width, height: copy.height, channels: 4 } }).rotate(rotate);
  const resized = width > 0 ? image.resize({ width, withoutEnlargement: true }) : image;
  const { data, info } = await resized.raw().toBuffer({ resolveWithObject: true });
  // A view on the same bytes: copying every pixel again is slow and doubles the memory.
  const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  const result = jsQR(pixels, info.width, info.height, { inversionAttempts: "attemptBoth" });
  const payload = result?.data?.trim() ?? "";
  return payload && payload.length <= MAX_PAYLOAD ? payload : null;
}

/** Read the QR payload from a ticket photo. We store that string and draw a
 *  fresh code from it — never a traced copy of the pixels. */
export async function decodeQrPayload(image: Buffer): Promise<string | null> {
  const copy = await loadScanCopy(image);
  if (!copy) return null;
  const widths = [0, 1200, 800, 1600];
  const rotations = [0, 90, 180, 270];
  for (const width of widths) {
    for (const rotate of rotations) {
      try {
        const payload = await tryDecode(copy, width, rotate);
        if (payload) return payload;
      } catch {
        // A bad rotation or resize should not abort the rest of the scan.
      }
    }
  }
  return null;
}

export async function qrSvg(payload: string) {
  return QRCode.toString(payload, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#11150c", light: "#ffffff" },
  });
}
