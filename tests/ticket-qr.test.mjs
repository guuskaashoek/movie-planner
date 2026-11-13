import { test } from "node:test";
import assert from "node:assert/strict";
import QRCode from "qrcode";
import sharp from "sharp";
import { decodeQrPayload, qrSvg } from "../lib/ticket-qr.ts";

test("a generated ticket QR round-trips to the same payload", async () => {
  const payload = "https://tickets.pathe.nl/preview/seat-12";
  const png = await QRCode.toBuffer(payload, { type: "png", margin: 2, width: 320, errorCorrectionLevel: "M" });
  assert.equal(await decodeQrPayload(png), payload);
  const svg = await qrSvg(payload);
  assert.match(svg, /<svg /);
  assert.match(svg, /<path /);
});

test("a QR inside a large phone photo is still found", async () => {
  const payload = "PATHE-4821-7730-SEAT-8-12";
  const qr = await QRCode.toBuffer(payload, { type: "png", margin: 2, width: 900, errorCorrectionLevel: "M" });
  const photo = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: "#d8d2c4" } })
    .composite([{ input: qr, left: 1500, top: 1000 }])
    .jpeg({ quality: 85 })
    .toBuffer();
  assert.equal(await decodeQrPayload(photo), payload);
  const sideways = await sharp(photo).rotate(90).jpeg({ quality: 85 }).toBuffer();
  assert.equal(await decodeQrPayload(sideways), payload);
});

test("an image with enormous dimensions is not scanned", async () => {
  // Under 1 MB as a file, 1 GB once unpacked.
  const bomb = await sharp({ create: { width: 16000, height: 16000, channels: 3, background: "#fff" } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  assert.ok(bomb.length < 2 * 1024 * 1024);
  const started = Date.now();
  assert.equal(await decodeQrPayload(bomb), null);
  assert.ok(Date.now() - started < 5000, "refused from the header, not after unpacking");
});

test("bytes that are not an image give no payload", async () => {
  assert.equal(await decodeQrPayload(Buffer.from("not an image at all")), null);
});
