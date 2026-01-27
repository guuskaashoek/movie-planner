import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { films } from "@/lib/db/schema";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") ?? "0");
  const safePage = Number.isNaN(page) || page < 0 ? 0 : page;

  // All films are on the shared board now
  const pageFilms = await db
    .select()
    .from(films)
    .orderBy(films.date, films.startTime)
    .limit(PAGE_SIZE)
    .offset(safePage * PAGE_SIZE);

  const totalFilms = await db.select({ count: films.id }).from(films);

  const hasMore = (totalFilms[0]?.count ?? 0) > (safePage + 1) * PAGE_SIZE;

  return NextResponse.json({
    films: pageFilms,
    hasMore,
  });
}

