import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";

const allowedTypes = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

const s3 = new S3Client({
  region: process.env.WASABI_REGION ?? "eu-central-1",
  endpoint:
    process.env.WASABI_ENDPOINT ??
    "https://s3.eu-central-1.wasabisys.com",
  credentials: {
    accessKeyId: process.env.WASABI_ACCESS_KEY ?? "",
    secretAccessKey: process.env.WASABI_SECRET_KEY ?? "",
  },
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return new NextResponse("No file provided", { status: 400 });
  }

  if (!allowedTypes.includes(file.type)) {
    return new NextResponse("Unsupported file type", { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return new NextResponse("File too large", { status: 400 });
  }

  const bucket = process.env.WASABI_BUCKET_NAME;
  if (!bucket) {
    return new NextResponse("Bucket not configured", { status: 500 });
  }

  const ext = file.name.split(".").pop() || "jpg";
  const key = `${randomUUID()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const body = Buffer.from(arrayBuffer);

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: file.type,
      ACL: "public-read",
    }),
  );

  const baseUrl =
    process.env.WASABI_PUBLIC_BASE ??
    `https://s3.eu-central-1.wasabisys.com/${bucket}`;

  const url = `${baseUrl}/${key}`;

  return NextResponse.json({ url });
}

