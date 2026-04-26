import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { films } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { s3, BUCKET_NAME } from "@/lib/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const [film] = await db
    .select({ posterUrl: films.posterUrl })
    .from(films)
    .where(eq(films.inviteToken, token))
    .limit(1);

  if (!film?.posterUrl || !film.posterUrl.includes("wasabisys.com")) {
    return new Response(null, { status: 404 });
  }

  const key = film.posterUrl.split("/").pop();
  if (!key || !BUCKET_NAME) {
    return new Response(null, { status: 404 });
  }

  try {
    const s3Response = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key })
    );

    if (!s3Response.Body) {
      return new Response(null, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webStream = (s3Response.Body as any).transformToWebStream();

    return new Response(webStream, {
      headers: {
        "Content-Type": s3Response.ContentType ?? "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch {
    return new Response(null, { status: 500 });
  }
}
