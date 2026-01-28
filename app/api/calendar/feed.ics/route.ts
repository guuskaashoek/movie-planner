import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { films, attendees, users, boardSettings } from "@/lib/db/schema";
import ical from "ical-generator";
import { eq, inArray } from "drizzle-orm";
import { signPosterUrl } from "@/lib/s3";

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
    .where(inArray(films.id, filmIds));

  const calendar = ical({
    name: "My Films",
    timezone: "Europe/Amsterdam",
  });

  for (const film of userFilms) {
    // Determine the event date: Screening Date > Release Date
    const targetDateString = film.date || film.releaseDate;

    // If no date at all, skip
    if (!targetDateString) continue;

    const eventDate = new Date(targetDateString);

    let start: Date = eventDate;
    let end: Date | null = null;
    let allDay = true;

    // If we have a screening date AND a start time, make it a time-based event
    if (film.date && film.startTime) {
      allDay = false;
      start = new Date(`${film.date}T${film.startTime}:00`);

      if (film.endTime) {
        end = new Date(`${film.date}T${film.endTime}:00`);
      } else {
        // Default duration 2 hours
        end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      }
    }

    // Create description with formats, release date and poster
    let description = "";

    if (film.formats) {
      description += `Format: ${film.formats}\n`;
    }

    if (film.releaseDate && film.date !== film.releaseDate) {
      description += `Release Date: ${film.releaseDate}\n`;
    }

    if (film.posterUrl) {
      // Sign URL for 7 days (604800 seconds)
      const signedUrl = await signPosterUrl(film.posterUrl, 604800);
      description += `\nPoster: ${signedUrl}`;
    }

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

    if (attendeeNames) {
      description += `\n\nAttending: ${attendeeNames}`;
    }

    // Create event
    calendar.createEvent({
      start,
      end: end || undefined,
      allDay,
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

