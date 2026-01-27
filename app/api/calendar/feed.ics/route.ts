import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { films, attendees, users, boardSettings } from "@/lib/db/schema";
import ical from "ical-generator";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  // Get user's share ID from query params
  const { searchParams } = new URL(req.url);
  const shareId = searchParams.get("userId");

  if (!shareId) {
    return new Response("Missing userId parameter", { status: 400 });
  }

  // Find user by share ID
  const [userSettings] = await db
    .select()
    .from(boardSettings)
    .where(eq(boardSettings.icsShareId, shareId));

  if (!userSettings) {
    return new Response("Invalid share ID", { status: 404 });
  }

  // Get films the user is attending
  const userAttendees = await db
    .select({
      filmId: attendees.filmId,
    })
    .from(attendees)
    .where(eq(attendees.userId, userSettings.userId));

  const filmIds = userAttendees.map((a) => a.filmId);

  if (filmIds.length === 0) {
    // Return empty calendar
    const calendar = ical({
      name: "My Films",
      timezone: "Europe/Amsterdam",
    });

    return new Response(calendar.toString(), {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="my-films.ics"',
      },
    });
  }

  // Get all films the user is attending
  const userFilms = await db
    .select()
    .from(films)
    .where(
      eq(
        films.id,
        filmIds.length === 1 ? filmIds[0] : (filmIds as any)
      )
    );

  const calendar = ical({
    name: "My Films",
    timezone: "Europe/Amsterdam",
  });

  for (const film of userFilms) {
    const date = film.date;
    const startTime = film.startTime ?? "20:00";
    const endTime = film.endTime ?? "22:00";

    const start = new Date(`${date}T${startTime}:00`);
    const end = new Date(`${date}T${endTime}:00`);

    // Get all attendees for this film
    const filmAttendees = await db
      .select({
        name: users.name,
        email: users.email,
      })
      .from(attendees)
      .innerJoin(users, eq(attendees.userId, users.id))
      .where(eq(attendees.filmId, film.id));

    const attendeeNames = filmAttendees
      .map((a) => a.name || a.email)
      .join(", ");

    let description = film.description || "";
    if (attendeeNames) {
      description += `\n\nAttending: ${attendeeNames}`;
    }

    calendar.createEvent({
      start,
      end,
      summary: film.title,
      description: description || undefined,
    });
  }

  const body = calendar.toString();

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="my-films.ics"',
    },
  });
}

