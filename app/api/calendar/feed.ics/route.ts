import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { films, attendees, users, boardSettings, pollOptions, pollVotes } from "@/lib/db/schema";
import ical from "ical-generator";
import { eq, inArray } from "drizzle-orm";
import { signPosterUrl } from "@/lib/s3";
import { getPollData } from "@/lib/poll";

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

  const calendar = ical({
    name: "My Films",
    timezone: "Europe/Amsterdam",
  });

  const emptyResponse = () =>
    new Response(calendar.toString(), {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="my-films.ics"',
      },
    });

  // Films the user is attending (non-poll "going")
  const userAttendees = await db
    .select({ filmId: attendees.filmId })
    .from(attendees)
    .where(eq(attendees.userId, userSettings.userId));

  // Films the user has voted on a poll for
  const userPollFilms = await db
    .select({ filmId: pollOptions.filmId })
    .from(pollVotes)
    .innerJoin(pollOptions, eq(pollVotes.optionId, pollOptions.id))
    .where(eq(pollVotes.userId, userSettings.userId));

  const filmIds = Array.from(
    new Set([
      ...userAttendees.map((a) => a.filmId),
      ...userPollFilms.map((p) => p.filmId),
    ])
  );

  if (filmIds.length === 0) {
    return emptyResponse();
  }

  const userFilms = await db.select().from(films).where(inArray(films.id, filmIds));
  const attendingFilmIds = new Set(userAttendees.map((a) => a.filmId));

  for (const film of userFilms) {
    const poll = await getPollData(film.id, film.allowMultiVote, userSettings.userId);

    // Determine the effective screening date/time and who's attending.
    let date: string | null;
    let startTime: string | null;
    let endTime: string | null;
    let attendeeList: { name: string | null; email: string }[];

    if (poll) {
      // No votes yet → no scheduled time → nothing in the calendar.
      const winner = poll.options.find((o) => o.isWinning);
      if (!winner) continue;
      // Only sync to people who voted for the winning slot.
      if (!winner.votedByMe) continue;
      date = winner.date;
      startTime = winner.startTime;
      endTime = winner.endTime;
      attendeeList = winner.voters.map((v) => ({ name: v.name, email: v.email }));
    } else {
      // Non-poll film: only include if the user is actually attending.
      if (!attendingFilmIds.has(film.id)) continue;
      date = film.date;
      startTime = film.startTime;
      endTime = film.endTime;
      const rows = await db
        .select({ name: users.name, email: users.email })
        .from(attendees)
        .innerJoin(users, eq(attendees.userId, users.id))
        .where(eq(attendees.filmId, film.id));
      attendeeList = rows;
    }

    // Determine the event date: Screening/poll Date > Release Date
    const targetDateString = date || film.releaseDate;
    if (!targetDateString) continue;

    const eventDate = new Date(targetDateString);

    let start: Date = eventDate;
    let end: Date | null = null;
    let allDay = true;

    if (date && startTime) {
      allDay = false;
      start = new Date(`${date}T${startTime}:00`);
      if (endTime) {
        end = new Date(`${date}T${endTime}:00`);
      } else {
        end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      }
    }

    let description = "";

    if (film.formats) {
      description += `Format: ${film.formats}\n`;
    }

    if (film.releaseDate && date !== film.releaseDate) {
      description += `Release Date: ${film.releaseDate}\n`;
    }

    if (film.posterUrl) {
      const signedUrl = await signPosterUrl(film.posterUrl, 604800);
      description += `\nPoster: ${signedUrl}`;
    }

    const attendeeNames = attendeeList.map((a) => a.name || a.email).join(", ");
    if (attendeeNames) {
      description += `\n\nAttending: ${attendeeNames}`;
    }

    calendar.createEvent({
      start,
      end: end || undefined,
      allDay,
      summary: film.title,
      description: description || undefined,
    });

    // If both special attendees are going, add a "don't forget grapes" reminder 30 min before
    const GRAPE_REMINDER_EMAILS = ["sherlockgnomezz@gmail.com", "lordofthegalaxyman@gmail.com"];
    const attendeeEmails = attendeeList.map((a) => a.email?.toLowerCase() ?? "");
    const bothPresent = GRAPE_REMINDER_EMAILS.every((e) => attendeeEmails.includes(e));

    if (bothPresent && !allDay) {
      const reminderStart = new Date(start.getTime() - 30 * 60 * 1000);
      const reminderEnd = new Date(start.getTime());
      calendar.createEvent({
        start: reminderStart,
        end: reminderEnd,
        summary: "Niet de druiven vergeten!",
        description: `Reminder voor ${film.title}: vergeet de druiven niet mee te nemen!`,
      });
    }
  }

  return new Response(calendar.toString(), {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="my-films.ics"',
    },
  });
}
