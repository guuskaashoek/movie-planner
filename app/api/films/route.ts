import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { films } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const filmSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable(),
  date: z.string().min(1),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  posterUrl: z.string().url().nullable(),
});

export async function GET() {
  const session = await auth();
  // @ts-expect-error added in auth callback
  const userId: number | undefined = session?.user?.id;
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const userFilms = await db
    .select()
    .from(films)
    .where(eq(films.userId, userId))
    .orderBy(films.date, films.startTime);

  return NextResponse.json({ films: userFilms });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  // @ts-expect-error added in auth callback
  const userId: number | undefined = session?.user?.id;
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const parsed = filmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(parsed.error.format(), { status: 400 });
  }

  const [inserted] = await db
    .insert(films)
    .values({
      ...parsed.data,
      userId,
    })
    .returning();

  return NextResponse.json({ film: inserted }, { status: 201 });
}

