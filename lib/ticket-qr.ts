import jsQR from "jsqr";
import QRCode from "qrcode";
import sharp from "sharp";

const MAX_PAYLOAD = 2048;

function asClamped(data: Buffer) {
  return Uint8ClampedArray.from(data);
}

async function tryDecode(buffer: Buffer, width: number, rotate: number) {
  const image = sharp(buffer).rotate(rotate).ensureAlpha();
  const resized = width > 0 ? image.resize({ width, withoutEnlargement: true }) : image;
  const { data, info } = await resized.raw().toBuffer({ resolveWithObject: true });
  const result = jsQR(asClamped(data), info.width, info.height, { inversionAttempts: "attemptBoth" });
  const payload = result?.data?.trim() ?? "";
  return payload && payload.length <= MAX_PAYLOAD ? payload : null;
}

/** Read the QR payload from a ticket photo. We store that string and draw a
 *  fresh code from it — never a traced copy of the pixels. */
export async function decodeQrPayload(image: Buffer): Promise<string | null> {
  const widths = [0, 1200, 800, 1600];
  const rotations = [0, 90, 180, 270];
  for (const width of widths) {
    for (const rotate of rotations) {
      try {
        const payload = await tryDecode(image, width, rotate);
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
