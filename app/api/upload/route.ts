import { NextRequest, NextResponse } from "next/server";
import { getSessionActor } from "@/lib/authz";
import { BUCKET_NAME } from "@/lib/s3";
import { readCappedBody } from "@/lib/body-limit";
import {
  ALLOWED_UPLOAD_TYPES,
  MAX_POSTER_BYTES,
  sniffImageType,
  storePoster,
} from "@/lib/images";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // getSessionActor, not auth(): a removed member's JWT stays valid.
  const actor = await getSessionActor();
  if (!actor) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // formData() buffers the whole body before the size check below, so cap
  // the raw multipart body first (poster limit + room for the form fields).
  const raw = await readCappedBody(req, MAX_POSTER_BYTES + 64 * 1024);
  if (!raw) {
    return new NextResponse(
      `File too large (max ${Math.round(MAX_POSTER_BYTES / 1024 / 1024)}MB)`,
      { status: 413 }
    );
  }
  let formData: FormData;
  try {
    formData = await new Request(req.url, { method: "POST", headers: req.headers, body: raw }).formData();
  } catch {
    return new NextResponse("Invalid form data", { status: 400 });
  }
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return new NextResponse("No file provided", { status: 400 });
  }

  if (file.type && !ALLOWED_UPLOAD_TYPES.includes(file.type)) {
    return new NextResponse(
      "Unsupported file type. Use JPEG, PNG, WebP or AVIF.",
      { status: 400 }
    );
  }

  if (file.size > MAX_POSTER_BYTES) {
    return new NextResponse(
      `File too large (max ${Math.round(MAX_POSTER_BYTES / 1024 / 1024)}MB)`,
      { status: 400 }
    );
  }

  const body = Buffer.from(await file.arrayBuffer());

  // The declared type and the filename can both be wrong; the bytes decide
  // what we store and which extension the key gets. Checked before the storage
  // config so a bad file is always answered with 400, never a 500.
  const kind = sniffImageType(body);
  if (!kind) {
    return new NextResponse(
      "That file is not a valid JPEG, PNG, WebP or AVIF image.",
      { status: 400 }
    );
  }

  if (!BUCKET_NAME) {
    return new NextResponse("Bucket not configured", { status: 500 });
  }

  const url = await storePoster(body, kind);

  return NextResponse.json({ url });
}
