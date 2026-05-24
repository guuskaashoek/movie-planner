import { db } from "@/lib/db/client";
import { pollOptions, pollVotes, users } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

export type PollVoter = {
  id: number;
  name: string | null;
  email: string;
  image: string | null;
};

export type PollOptionData = {
  id: number;
  date: string;
  startTime: string | null;
  endTime: string | null;
  voteCount: number;
  voters: PollVoter[];
  votedByMe: boolean;
  isWinning: boolean;
};

export type PollData = {
  allowMultiVote: boolean;
  options: PollOptionData[];
  totalVoters: number;
  winningOptionId: number | null;
};

/**
 * Pick the winning option: most votes wins. Ties break to the earliest
 * date/time, then the lowest id (stable). An option with zero votes can
 * never win, so a poll with no votes has no winner (nothing is scheduled).
 */
function pickWinner(
  options: { id: number; date: string; startTime: string | null; voteCount: number }[]
): number | null {
  let winner: (typeof options)[number] | null = null;
  for (const opt of options) {
    if (opt.voteCount === 0) continue;
    if (!winner) {
      winner = opt;
      continue;
    }
    if (opt.voteCount !== winner.voteCount) {
      if (opt.voteCount > winner.voteCount) winner = opt;
      continue;
    }
    // Tie on vote count → earliest date, then earliest time, then lowest id.
    const aKey = `${opt.date}T${opt.startTime ?? "99:99"}`;
    const bKey = `${winner.date}T${winner.startTime ?? "99:99"}`;
    if (aKey < bKey || (aKey === bKey && opt.id < winner.id)) {
      winner = opt;
    }
  }
  return winner?.id ?? null;
}

/**
 * Load the poll for a film. Returns null when the film has no poll options.
 */
export async function getPollData(
  filmId: number,
  allowMultiVote: boolean,
  currentUserId: number | null
): Promise<PollData | null> {
  const options = await db
    .select()
    .from(pollOptions)
    .where(eq(pollOptions.filmId, filmId))
    .orderBy(pollOptions.sortOrder, pollOptions.id);

  if (options.length === 0) return null;

  const optionIds = options.map((o) => o.id);

  const voteRows = await db
    .select({
      optionId: pollVotes.optionId,
      userId: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
    })
    .from(pollVotes)
    .innerJoin(users, eq(pollVotes.userId, users.id))
    .where(inArray(pollVotes.optionId, optionIds));

  const votersByOption = new Map<number, PollVoter[]>();
  const distinctVoters = new Set<number>();
  for (const row of voteRows) {
    const list = votersByOption.get(row.optionId) ?? [];
    list.push({ id: row.userId, name: row.name, email: row.email, image: row.image });
    votersByOption.set(row.optionId, list);
    distinctVoters.add(row.userId);
  }

  const withCounts = options.map((o) => {
    const voters = votersByOption.get(o.id) ?? [];
    return {
      id: o.id,
      date: o.date,
      startTime: o.startTime,
      endTime: o.endTime,
      voteCount: voters.length,
      voters,
      votedByMe: currentUserId != null && voters.some((v) => v.id === currentUserId),
    };
  });

  const winningOptionId = pickWinner(withCounts);

  return {
    allowMultiVote,
    totalVoters: distinctVoters.size,
    winningOptionId,
    options: withCounts.map((o) => ({ ...o, isWinning: o.id === winningOptionId })),
  };
}
