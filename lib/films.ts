import { db } from "@/lib/db/client";
import {
  attendees,
  boardSettings,
  comments,
  filmRatings,
  films,
  pollOptions,
  pollVotes,
  users,
} from "@/lib/db/schema";
import { and, eq, gte, inArray, isNull, like, or, sql, desc } from "drizzle-orm";
import { randomBytes } from "crypto";
import { signPosterUrl } from "@/lib/s3";
import { importPosterFromUrl } from "@/lib/images";
import { getPollData } from "@/lib/poll";
import { getComments } from "@/lib/comments";
import { publishLiveEvent } from "@/lib/live";
import { type Actor, canManageFilm, canManageComment, resolveRole } from "@/lib/authz";

/**
 * Everything in this module is written against an Actor rather than a session,
 * so the web routes and the MCP server share one set of permission rules:
 * an admin may manage every film, a normal user only their own.
 */
export class ServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function assertDate(value: string | null | undefined, field: string) {
  if (value != null && value !== "" && !DATE_RE.test(value)) {
    throw new ServiceError(`${field} must be formatted as YYYY-MM-DD`, 400);
  }
}

function assertTime(value: string | null | undefined, field: string) {
  if (value != null && value !== "" && !TIME_RE.test(value)) {
    throw new ServiceError(`${field} must be formatted as HH:mm (24h)`, 400);
  }
}

/** Ticket links are shown to people, so only real web links are accepted. */
function assertTicketsUrl(value: string | null | undefined) {
  if (value == null || value.trim() === "") return;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new ServiceError("ticketsUrl must be a full URL, e.g. https://...", 400);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ServiceError("ticketsUrl must start with http:// or https://", 400);
  }
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

export function hasFilmEnded(date: string | null, endTime: string | null): boolean {
  if (!date) return false;
  const now = new Date();
  const t = today();
  if (date < t) return true;
  if (date > t) return false;
  if (!endTime) return false;
  const [h, m] = endTime.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return false;
  const endAt = new Date(now);
  endAt.setHours(h, m, 0, 0);
  return now >= endAt;
}

async function loadFilm(filmId: number) {
  if (!Number.isInteger(filmId)) {
    throw new ServiceError("filmId must be an integer", 400);
  }
  const [film] = await db.select().from(films).where(eq(films.id, filmId)).limit(1);
  if (!film) throw new ServiceError(`No film with id ${filmId}`, 404);
  return film;
}

/** Load a film and confirm the actor is allowed to change it. */
async function loadManageableFilm(actor: Actor, filmId: number) {
  const film = await loadFilm(filmId);
  if (!canManageFilm(actor, film)) {
    throw new ServiceError(
      "You can only manage films you created. Ask an admin if you need to change this one.",
      403
    );
  }
  return film;
}

function requireAdmin(actor: Actor) {
  if (!actor.isAdmin) {
    throw new ServiceError("This action requires an admin account", 403);
  }
}

async function resolveUserRef(ref: string | number): Promise<{
  id: number;
  email: string;
  name: string | null;
  role: string;
}> {
  const rows =
    typeof ref === "number" || /^\d+$/.test(String(ref))
      ? await db
          .select({ id: users.id, email: users.email, name: users.name, role: users.role })
          .from(users)
          .where(eq(users.id, Number(ref)))
          .limit(1)
      : await db
          .select({ id: users.id, email: users.email, name: users.name, role: users.role })
          .from(users)
          .where(eq(users.email, String(ref).trim().toLowerCase()))
          .limit(1);

  if (!rows[0]) throw new ServiceError(`No user matching "${ref}"`, 404);
  return rows[0];
}

// ---------------------------------------------------------------------------
// Reading films
// ---------------------------------------------------------------------------

export type FilmView = Awaited<ReturnType<typeof buildFilmView>>;

async function buildFilmView(
  film: typeof films.$inferSelect,
  actor: Actor,
  opts: { includeComments?: boolean } = {}
) {
  const [creator] = await db
    .select({ id: users.id, name: users.name, email: users.email, image: users.image })
    .from(users)
    .where(eq(users.id, film.createdBy))
    .limit(1);

  const attendeeRows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      type: attendees.type,
    })
    .from(attendees)
    .innerJoin(users, eq(attendees.userId, users.id))
    .where(eq(attendees.filmId, film.id));

  const going = attendeeRows.filter((a) => a.type === "going");
  const interested = attendeeRows.filter((a) => a.type === "interested");

  const ratingRows = await db
    .select({ rating: filmRatings.rating, userId: filmRatings.userId })
    .from(filmRatings)
    .where(eq(filmRatings.filmId, film.id));

  const ratingCount = ratingRows.length;
  const averageRating =
    ratingCount > 0
      ? Math.round((ratingRows.reduce((s, r) => s + r.rating, 0) / ratingCount) * 100) / 100
      : null;

  const poll = await getPollData(film.id, film.allowMultiVote, actor.userId);
  const posterUrl = await signPosterUrl(film.posterUrl);

  return {
    id: film.id,
    title: film.title,
    description: film.description,
    date: film.date,
    releaseDate: film.releaseDate,
    startTime: film.startTime,
    endTime: film.endTime,
    formats: film.formats,
    ticketsOnSaleDate: film.ticketsOnSaleDate,
    ticketsOnSaleTime: film.ticketsOnSaleTime,
    ticketsUrl: film.ticketsUrl,
    ticketsOnSaleAt: film.ticketsOnSaleDate
      ? `${film.ticketsOnSaleDate}${film.ticketsOnSaleTime ? `T${film.ticketsOnSaleTime}` : ""}`
      : null,
    posterUrl,
    posterStoredUrl: film.posterUrl,
    inviteToken: film.inviteToken,
    allowMultiVote: film.allowMultiVote,
    createdAt: Number(film.createdAt),
    createdBy: film.createdBy,
    creator: creator ?? null,
    goingUsers: going,
    interestedUsers: interested,
    attendeeCount: going.length,
    isGoing: going.some((a) => a.id === actor.userId),
    isInterested: interested.some((a) => a.id === actor.userId),
    myRating: ratingRows.find((r) => r.userId === actor.userId)?.rating ?? null,
    ratingCount,
    averageRating,
    hasEnded: hasFilmEnded(film.date, film.endTime),
    poll,
    canManage: canManageFilm(actor, film),
    ...(opts.includeComments ? { comments: await getComments(film.id) } : {}),
  };
}

export type ListFilmsOptions = {
  /** "all" (default), "upcoming", "past", or "mine". */
  scope?: "all" | "upcoming" | "past" | "mine";
  /** Case-insensitive match on title/description. */
  query?: string | null;
  /** Restrict to films created by this user (id or email). Admin-friendly. */
  owner?: string | number | null;
  limit?: number;
  offset?: number;
};

export async function listFilms(actor: Actor, options: ListFilmsOptions = {}) {
  const { scope = "all", query, owner } = options;
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);

  const conditions = [];

  if (scope === "upcoming") {
    conditions.push(or(isNull(films.date), gte(films.date, today())));
  } else if (scope === "past") {
    conditions.push(and(sql`${films.date} is not null`, sql`${films.date} < ${today()}`));
  } else if (scope === "mine") {
    conditions.push(eq(films.createdBy, actor.userId));
  }

  if (owner != null && owner !== "") {
    const target = await resolveUserRef(owner);
    conditions.push(eq(films.createdBy, target.id));
  }

  if (query && query.trim()) {
    const needle = `%${query.trim().toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`lower(${films.title})`, needle),
        like(sql`lower(coalesce(${films.description}, ''))`, needle)
      )
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(films)
    .where(where)
    .orderBy(films.date, films.startTime, films.id)
    .limit(limit)
    .offset(offset);

  const [count] = await db
    .select({ total: sql<number>`count(*)` })
    .from(films)
    .where(where);

  const items = await Promise.all(rows.map((f) => buildFilmView(f, actor)));

  return {
    films: items,
    total: Number(count?.total ?? 0),
    limit,
    offset,
    hasMore: offset + rows.length < Number(count?.total ?? 0),
  };
}

export async function getFilm(actor: Actor, filmId: number) {
  const film = await loadFilm(filmId);
  return buildFilmView(film, actor, { includeComments: true });
}

// ---------------------------------------------------------------------------
// Writing films
// ---------------------------------------------------------------------------

export type PollOptionInput = {
  id?: number;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
};

export type CreateFilmInput = {
  title: string;
  description?: string | null;
  date?: string | null;
  releaseDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  formats?: string | null;
  /** When tickets go on sale: YYYY-MM-DD plus an optional HH:mm. */
  ticketsOnSaleDate?: string | null;
  ticketsOnSaleTime?: string | null;
  ticketsUrl?: string | null;
  /** Any public image URL; it is downloaded and re-hosted in our bucket. */
  posterUrl?: string | null;
  allowMultiVote?: boolean;
  pollOptions?: PollOptionInput[];
  /** Admin only: create the film on behalf of another user (id or email). */
  ownerRef?: string | number | null;
};

function normalise(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function createFilm(actor: Actor, input: CreateFilmInput) {
  const title = normalise(input.title);
  if (!title) throw new ServiceError("title is required", 400);

  assertDate(input.date, "date");
  assertDate(input.releaseDate, "releaseDate");
  assertDate(input.ticketsOnSaleDate, "ticketsOnSaleDate");
  assertTime(input.startTime, "startTime");
  assertTime(input.endTime, "endTime");
  assertTime(input.ticketsOnSaleTime, "ticketsOnSaleTime");
  assertTicketsUrl(input.ticketsUrl);

  let createdBy = actor.userId;
  if (input.ownerRef != null && input.ownerRef !== "") {
    requireAdmin(actor);
    createdBy = (await resolveUserRef(input.ownerRef)).id;
  }

  let posterUrl: string | null = null;
  if (normalise(input.posterUrl)) {
    posterUrl = (await importPosterFromUrl(input.posterUrl!)).url;
  }

  const [inserted] = await db
    .insert(films)
    .values({
      title,
      description: normalise(input.description),
      date: normalise(input.date),
      releaseDate: normalise(input.releaseDate),
      startTime: normalise(input.startTime),
      endTime: normalise(input.endTime),
      formats: normalise(input.formats),
      ticketsOnSaleDate: normalise(input.ticketsOnSaleDate),
      ticketsOnSaleTime: normalise(input.ticketsOnSaleTime),
      ticketsUrl: normalise(input.ticketsUrl),
      posterUrl,
      allowMultiVote: input.allowMultiVote ?? false,
      createdBy,
      inviteToken: randomBytes(16).toString("hex"),
    })
    .returning();

  // The creator is going by default, mirroring the web UI.
  await db.insert(attendees).values({ filmId: inserted.id, userId: createdBy, type: "going" });

  if (input.pollOptions && input.pollOptions.length > 0) {
    await writePollOptions(inserted.id, input.pollOptions, input.allowMultiVote ?? false);
  }

  publishLiveEvent({ topic: "film", filmId: inserted.id });
  return getFilm(actor, inserted.id);
}

export type UpdateFilmInput = Partial<
  Pick<
    CreateFilmInput,
    | "title"
    | "description"
    | "date"
    | "releaseDate"
    | "startTime"
    | "endTime"
    | "formats"
    | "ticketsOnSaleDate"
    | "ticketsOnSaleTime"
    | "ticketsUrl"
    | "posterUrl"
    | "allowMultiVote"
  >
>;

export async function updateFilm(actor: Actor, filmId: number, patch: UpdateFilmInput) {
  await loadManageableFilm(actor, filmId);

  assertDate(patch.date, "date");
  assertDate(patch.releaseDate, "releaseDate");
  assertDate(patch.ticketsOnSaleDate, "ticketsOnSaleDate");
  assertTime(patch.startTime, "startTime");
  assertTime(patch.endTime, "endTime");
  assertTime(patch.ticketsOnSaleTime, "ticketsOnSaleTime");
  assertTicketsUrl(patch.ticketsUrl);

  const update: Record<string, unknown> = {};

  if (patch.title !== undefined) {
    const title = normalise(patch.title);
    if (!title) throw new ServiceError("title cannot be empty", 400);
    update.title = title;
  }
  if (patch.description !== undefined) update.description = normalise(patch.description);
  if (patch.date !== undefined) update.date = normalise(patch.date);
  if (patch.releaseDate !== undefined) update.releaseDate = normalise(patch.releaseDate);
  if (patch.startTime !== undefined) update.startTime = normalise(patch.startTime);
  if (patch.endTime !== undefined) update.endTime = normalise(patch.endTime);
  if (patch.formats !== undefined) update.formats = normalise(patch.formats);
  if (patch.ticketsOnSaleDate !== undefined) {
    update.ticketsOnSaleDate = normalise(patch.ticketsOnSaleDate);
  }
  if (patch.ticketsOnSaleTime !== undefined) {
    update.ticketsOnSaleTime = normalise(patch.ticketsOnSaleTime);
  }
  if (patch.ticketsUrl !== undefined) update.ticketsUrl = normalise(patch.ticketsUrl);
  if (patch.allowMultiVote !== undefined) update.allowMultiVote = patch.allowMultiVote;

  if (patch.posterUrl !== undefined) {
    const raw = normalise(patch.posterUrl);
    update.posterUrl = raw ? (await importPosterFromUrl(raw)).url : null;
  }

  if (Object.keys(update).length === 0) {
    throw new ServiceError("No fields to update were provided", 400);
  }

  await db.update(films).set(update).where(eq(films.id, filmId));

  publishLiveEvent({ topic: "film", filmId });
  return getFilm(actor, filmId);
}

export async function setFilmPoster(actor: Actor, filmId: number, url: string) {
  await loadManageableFilm(actor, filmId);
  const imported = await importPosterFromUrl(url);
  await db.update(films).set({ posterUrl: imported.url }).where(eq(films.id, filmId));
  publishLiveEvent({ topic: "film", filmId });
  return {
    filmId,
    storedUrl: imported.url,
    contentType: imported.contentType,
    bytes: imported.bytes,
    reused: imported.reused,
    viewUrl: await signPosterUrl(imported.url),
  };
}

export async function deleteFilm(actor: Actor, filmId: number) {
  const film = await loadManageableFilm(actor, filmId);
  await db.delete(films).where(eq(films.id, filmId));
  publishLiveEvent({ topic: "film", filmId });
  return { deleted: true, filmId, title: film.title };
}

/** Admin only: hand a film over to a different owner. */
export async function transferFilm(actor: Actor, filmId: number, ownerRef: string | number) {
  requireAdmin(actor);
  await loadFilm(filmId);
  const target = await resolveUserRef(ownerRef);
  await db.update(films).set({ createdBy: target.id }).where(eq(films.id, filmId));
  publishLiveEvent({ topic: "film", filmId });
  return getFilm(actor, filmId);
}

// ---------------------------------------------------------------------------
// Polls
// ---------------------------------------------------------------------------

async function writePollOptions(
  filmId: number,
  options: PollOptionInput[],
  allowMultiVote: boolean
) {
  if (options.length > 20) {
    throw new ServiceError("A poll can hold at most 20 options", 400);
  }
  for (const opt of options) {
    if (!opt.date || !DATE_RE.test(opt.date)) {
      throw new ServiceError("Each poll option needs a date formatted as YYYY-MM-DD", 400);
    }
    assertTime(opt.startTime, "poll option startTime");
    assertTime(opt.endTime, "poll option endTime");
  }

  const existing = await db.select().from(pollOptions).where(eq(pollOptions.filmId, filmId));
  const existingById = new Map(existing.map((o) => [o.id, o]));

  const keepIds = options
    .map((o) => o.id)
    .filter((id): id is number => id != null && existingById.has(id));

  const toDelete = existing.filter((o) => !keepIds.includes(o.id));
  if (toDelete.length > 0) {
    await db.delete(pollOptions).where(
      inArray(
        pollOptions.id,
        toDelete.map((o) => o.id)
      )
    );
  }

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const startTime = normalise(opt.startTime);
    const endTime = normalise(opt.endTime);

    if (opt.id != null && existingById.has(opt.id)) {
      const prev = existingById.get(opt.id)!;
      const slotChanged =
        prev.date !== opt.date || prev.startTime !== startTime || prev.endTime !== endTime;
      // Moving a slot invalidates the votes cast for the old one.
      if (slotChanged) {
        await db.delete(pollVotes).where(eq(pollVotes.optionId, opt.id));
      }
      await db
        .update(pollOptions)
        .set({ date: opt.date, startTime, endTime, sortOrder: i })
        .where(eq(pollOptions.id, opt.id));
    } else {
      await db
        .insert(pollOptions)
        .values({ filmId, date: opt.date, startTime, endTime, sortOrder: i });
    }
  }

  await db.update(films).set({ allowMultiVote }).where(eq(films.id, filmId));
}

export async function setPoll(
  actor: Actor,
  filmId: number,
  input: { allowMultiVote: boolean; options: PollOptionInput[] }
) {
  await loadManageableFilm(actor, filmId);
  await writePollOptions(filmId, input.options, input.allowMultiVote);
  publishLiveEvent({ topic: "poll", filmId });
  return getPollData(filmId, input.allowMultiVote, actor.userId);
}

export async function voteOnPoll(
  actor: Actor,
  filmId: number,
  optionId: number,
  opts: { remove?: boolean; asUserRef?: string | number | null } = {}
) {
  const film = await loadFilm(filmId);

  let voterId = actor.userId;
  if (opts.asUserRef != null && opts.asUserRef !== "") {
    requireAdmin(actor);
    voterId = (await resolveUserRef(opts.asUserRef)).id;
  }

  const [option] = await db
    .select()
    .from(pollOptions)
    .where(and(eq(pollOptions.id, optionId), eq(pollOptions.filmId, filmId)))
    .limit(1);
  if (!option) throw new ServiceError(`Film ${filmId} has no poll option ${optionId}`, 404);

  if (opts.remove) {
    await db
      .delete(pollVotes)
      .where(and(eq(pollVotes.optionId, optionId), eq(pollVotes.userId, voterId)));
  } else {
    if (!film.allowMultiVote) {
      // Single-choice poll: replace any earlier vote on this film.
      const ids = (
        await db
          .select({ id: pollOptions.id })
          .from(pollOptions)
          .where(eq(pollOptions.filmId, filmId))
      ).map((o) => o.id);
      if (ids.length > 0) {
        await db
          .delete(pollVotes)
          .where(and(inArray(pollVotes.optionId, ids), eq(pollVotes.userId, voterId)));
      }
    }
    try {
      await db.insert(pollVotes).values({ optionId, userId: voterId });
    } catch {
      // Unique constraint: the vote already exists.
    }
  }

  publishLiveEvent({ topic: "poll", filmId });
  return getPollData(filmId, film.allowMultiVote, actor.userId);
}

// ---------------------------------------------------------------------------
// Attendance, comments, ratings
// ---------------------------------------------------------------------------

export async function setAttendance(
  actor: Actor,
  filmId: number,
  input: {
    type?: "going" | "interested";
    attending: boolean;
    asUserRef?: string | number | null;
  }
) {
  await loadFilm(filmId);
  const type = input.type === "interested" ? "interested" : "going";

  let targetUserId = actor.userId;
  if (input.asUserRef != null && input.asUserRef !== "") {
    requireAdmin(actor);
    targetUserId = (await resolveUserRef(input.asUserRef)).id;
  }

  if (input.attending) {
    const existing = await db
      .select({ id: attendees.id })
      .from(attendees)
      .where(
        and(
          eq(attendees.filmId, filmId),
          eq(attendees.userId, targetUserId),
          eq(attendees.type, type)
        )
      )
      .limit(1);
    if (existing.length === 0) {
      await db.insert(attendees).values({ filmId, userId: targetUserId, type });
    }
  } else {
    await db
      .delete(attendees)
      .where(
        and(
          eq(attendees.filmId, filmId),
          eq(attendees.userId, targetUserId),
          eq(attendees.type, type)
        )
      );
  }

  publishLiveEvent({ topic: "attendance", filmId });

  // `image` matters: the web clients drop this list straight into the avatar
  // rows they render after a Going/Interested click.
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      type: attendees.type,
    })
    .from(attendees)
    .innerJoin(users, eq(attendees.userId, users.id))
    .where(eq(attendees.filmId, filmId));

  return {
    filmId,
    type,
    attending: input.attending,
    goingUsers: rows.filter((r) => r.type === "going"),
    interestedUsers: rows.filter((r) => r.type === "interested"),
  };
}

export async function addComment(actor: Actor, filmId: number, body: string) {
  await loadFilm(filmId);
  const text = body?.trim();
  if (!text) throw new ServiceError("Comment body cannot be empty", 400);
  if (text.length > 2000) throw new ServiceError("Comment is longer than 2000 characters", 400);

  await db.insert(comments).values({ filmId, userId: actor.userId, body: text });
  publishLiveEvent({ topic: "comment", filmId });
  return getComments(filmId);
}

export async function deleteComment(actor: Actor, filmId: number, commentId: number) {
  const film = await loadFilm(filmId);
  const [comment] = await db
    .select()
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.filmId, filmId)))
    .limit(1);
  if (!comment) throw new ServiceError(`No comment ${commentId} on film ${filmId}`, 404);

  if (!canManageComment(actor, comment, film)) {
    throw new ServiceError("You may only delete your own comments", 403);
  }

  await db.delete(comments).where(eq(comments.id, commentId));
  publishLiveEvent({ topic: "comment", filmId });
  return getComments(filmId);
}

export async function rateFilm(
  actor: Actor,
  filmId: number,
  rating: number,
  opts: { asUserRef?: string | number | null } = {}
) {
  const film = await loadFilm(filmId);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ServiceError("rating must be a whole number from 1 to 5", 400);
  }

  let raterId = actor.userId;
  if (opts.asUserRef != null && opts.asUserRef !== "") {
    requireAdmin(actor);
    raterId = (await resolveUserRef(opts.asUserRef)).id;
  }

  // Admins may correct ratings at any time; everyone else must have attended a
  // screening that has already finished.
  if (!actor.isAdmin) {
    const [attendance] = await db
      .select({ id: attendees.id })
      .from(attendees)
      .where(and(eq(attendees.filmId, filmId), eq(attendees.userId, raterId)))
      .limit(1);
    if (!attendance) throw new ServiceError("Only attendees can rate this film", 403);
    if (!hasFilmEnded(film.date, film.endTime)) {
      throw new ServiceError("You can rate a film after the screening has ended", 400);
    }
  }

  await db
    .insert(filmRatings)
    .values({ filmId, userId: raterId, rating })
    .onConflictDoUpdate({
      target: [filmRatings.filmId, filmRatings.userId],
      set: { rating },
    });

  const [stats] = await db
    .select({
      averageRating: sql<number | null>`avg(${filmRatings.rating})`,
      ratingCount: sql<number>`count(*)`,
    })
    .from(filmRatings)
    .where(eq(filmRatings.filmId, filmId));

  publishLiveEvent({ topic: "rating", filmId });
  return {
    filmId,
    rating,
    averageRating: stats?.averageRating ?? null,
    ratingCount: Number(stats?.ratingCount ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Users (admin)
// ---------------------------------------------------------------------------

export async function listUsers(actor: Actor) {
  requireAdmin(actor);

  // Counted with a join rather than a correlated subquery: inside a raw sql
  // template drizzle renders users.id unqualified, which SQLite would resolve
  // against the inner table.
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
      role: users.role,
      createdAt: users.createdAt,
      filmCount: sql<number>`count(${films.id})`,
    })
    .from(users)
    .leftJoin(films, eq(films.createdBy, users.id))
    .groupBy(users.id)
    .orderBy(desc(users.createdAt));

  return rows.map((u) => ({
    ...u,
    createdAt: Number(u.createdAt),
    filmCount: Number(u.filmCount),
    role: resolveRole(u.email, u.role),
    isBootstrapAdmin: resolveRole(u.email, "user") === "admin",
  }));
}

export async function setUserRole(
  actor: Actor,
  userRef: string | number,
  role: "user" | "admin"
) {
  requireAdmin(actor);
  if (role !== "user" && role !== "admin") {
    throw new ServiceError('role must be "user" or "admin"', 400);
  }

  const target = await resolveUserRef(userRef);

  if (target.id === actor.userId && role === "user") {
    throw new ServiceError("You cannot remove your own admin rights", 400);
  }

  await db.update(users).set({ role }).where(eq(users.id, target.id));

  const effective = resolveRole(target.email, role);
  return {
    userId: target.id,
    email: target.email,
    name: target.name,
    role: effective,
    // ADMIN_EMAILS wins over the stored role, so say so rather than lying.
    note:
      effective !== role
        ? "This user stays an admin because their email is listed in ADMIN_EMAILS."
        : undefined,
  };
}

/** A compact overview for admins: counts plus the busiest owners. */
export async function getStats(actor: Actor) {
  requireAdmin(actor);

  const [counts] = await db
    .select({
      films: sql<number>`(select count(*) from films)`,
      users: sql<number>`(select count(*) from users)`,
      comments: sql<number>`(select count(*) from comments)`,
      votes: sql<number>`(select count(*) from poll_votes)`,
      ratings: sql<number>`(select count(*) from film_ratings)`,
      upcoming: sql<number>`(select count(*) from films where date is null or date >= ${today()})`,
    })
    .from(sql`(select 1)`);

  const byOwner = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      filmCount: sql<number>`count(${films.id})`,
    })
    .from(users)
    .leftJoin(films, eq(films.createdBy, users.id))
    .groupBy(users.id)
    .orderBy(desc(sql`count(${films.id})`));

  return {
    totals: {
      films: Number(counts?.films ?? 0),
      users: Number(counts?.users ?? 0),
      comments: Number(counts?.comments ?? 0),
      votes: Number(counts?.votes ?? 0),
      ratings: Number(counts?.ratings ?? 0),
      upcomingFilms: Number(counts?.upcoming ?? 0),
    },
    filmsByOwner: byOwner.map((o) => ({ ...o, filmCount: Number(o.filmCount) })),
  };
}

// ---------------------------------------------------------------------------
// Calendar feed
// ---------------------------------------------------------------------------

/** Public base URL of this deployment, used to build shareable links. */
export function publicBaseUrl(): string {
  const base =
    process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3000";
  return base.replace(/\/$/, "");
}

/**
 * The personal `.ics` subscription URL, creating the share id on first use so
 * an MCP client can hand it to the user without them opening the board first.
 */
export async function getCalendarFeed(actor: Actor) {
  let [settings] = await db
    .select()
    .from(boardSettings)
    .where(eq(boardSettings.userId, actor.userId))
    .limit(1);

  if (!settings) {
    [settings] = await db
      .insert(boardSettings)
      .values({
        userId: actor.userId,
        name: `${actor.name || actor.email}'s Calendar`,
        icsShareId: randomBytes(16).toString("hex"),
      })
      .returning();
  }

  return {
    name: settings.name,
    icsUrl: `${publicBaseUrl()}/api/calendar/feed.ics?userId=${settings.icsShareId}`,
    boardUrl: `${publicBaseUrl()}/board`,
  };
}
