import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { films, pollOptions, pollVotes } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getPollData } from "@/lib/poll";

type RouteParams = { params: Promise<{ id: string }> };

const optionSchema = z.object({
  id: z.number().int().positive().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
});

const pollSchema = z.object({
  allowMultiVote: z.boolean(),
  options: z.array(optionSchema).max(20),
});

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  // @ts-expect-error added in auth callback
  const userId: number | undefined = session?.user?.id;
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { id: idParam } = await params;
  const filmId = Number(idParam);
  if (Number.isNaN(filmId)) return new NextResponse("Invalid film ID", { status: 400 });

  const parsed = pollSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(parsed.error.format(), { status: 400 });
  }

  // Only the creator may edit the poll.
  const [film] = await db
    .select()
    .from(films)
    .where(and(eq(films.id, filmId), eq(films.createdBy, userId)))
    .limit(1);
  if (!film) return new NextResponse("Not found", { status: 404 });

  const { allowMultiVote, options } = parsed.data;

  const existing = await db
    .select()
    .from(pollOptions)
    .where(eq(pollOptions.filmId, filmId));
  const existingById = new Map(existing.map((o) => [o.id, o]));

  const keepIds = options
    .map((o) => o.id)
    .filter((id): id is number => id != null && existingById.has(id));

  // Remove options that are no longer present (cascade deletes their votes).
  const toDelete = existing.filter((o) => !keepIds.includes(o.id));
  if (toDelete.length > 0) {
    await db
      .delete(pollOptions)
      .where(inArray(pollOptions.id, toDelete.map((o) => o.id)));
  }

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const startTime = opt.startTime || null;
    const endTime = opt.endTime || null;

    if (opt.id != null && existingById.has(opt.id)) {
      const prev = existingById.get(opt.id)!;
      const slotChanged =
        prev.date !== opt.date ||
        prev.startTime !== startTime ||
        prev.endTime !== endTime;
      // Changing when an option happens invalidates votes for the old slot.
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

  const poll = await getPollData(filmId, allowMultiVote, userId);
  return NextResponse.json({ poll });
}
