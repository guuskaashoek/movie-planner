import { test } from "node:test";
import assert from "node:assert/strict";
import QRCode from "qrcode";
import { decodeQrPayload, qrSvg } from "../lib/ticket-qr.ts";

test("a generated ticket QR round-trips to the same payload", async () => {
  const payload = "https://tickets.pathe.nl/preview/seat-12";
  const png = await QRCode.toBuffer(payload, { type: "png", margin: 2, width: 320, errorCorrectionLevel: "M" });
  assert.equal(await decodeQrPayload(png), payload);
  const svg = await qrSvg(payload);
  assert.match(svg, /<svg /);
  assert.match(svg, /<path /);
});
