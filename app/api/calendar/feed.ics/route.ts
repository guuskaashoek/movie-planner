import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { films } from "@/lib/db/schema";
import ical from "ical-generator";
import { eq } from "drizzle-orm";

export async function GET(_req: NextRequest) {
  const boardFilms = await db
    .select()
    .from(films)
    .where(eq(films.isOnMainBoard, true));

  const calendar = ical({
    name: "Film Board",
    timezone: "Europe/Amsterdam",
  });

  for (const film of boardFilms) {
    const date = film.date;
    const startTime = film.startTime ?? "20:00";
    const endTime = film.endTime ?? "22:00";

    const start = new Date(`${date}T${startTime}:00`);
    const end = new Date(`${date}T${endTime}:00`);

    calendar.createEvent({
      start,
      end,
      summary: film.title,
      description: film.description ?? undefined,
    });
  }

  const body = calendar.toString();

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="film-board.ics"',
    },
  });
}

