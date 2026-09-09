/** Ticket images are visible only to someone attending the fixed screening or
 * to someone who voted for the winning slot of a date poll. */
export function mayViewAdmissionTickets(input: {
  isDirectlyGoing: boolean;
  votedForWinningPollOption: boolean;
}) {
  return input.isDirectlyGoing || input.votedForWinningPollOption;
}

export type WalletTicketRow = {
  id: number;
  label: string;
  hasQr: boolean;
  filmId: number;
  title: string;
  date: string | null;
  startTime: string | null;
  formats: string | null;
  posterUrl: string | null;
  isDirectlyGoing: boolean;
  votedForWinningPollOption: boolean;
};

export type WalletGroup = {
  filmId: number;
  title: string;
  date: string | null;
  startTime: string | null;
  formats: string | null;
  posterUrl: string | null;
  tickets: { id: number; label: string; hasQr: boolean }[];
};

function byScreening(a: WalletGroup, b: WalletGroup) {
  return (a.date || "9999").localeCompare(b.date || "9999") || a.filmId - b.filmId;
}

/** Group visible admission tickets by film. Upcoming first, then past. */
export function buildTicketWallet(rows: WalletTicketRow[], today: string) {
  const groups = new Map<number, WalletGroup>();
  for (const row of rows) {
    if (!mayViewAdmissionTickets({
      isDirectlyGoing: row.isDirectlyGoing,
      votedForWinningPollOption: row.votedForWinningPollOption,
    })) continue;
    const existing = groups.get(row.filmId);
    if (existing) {
      existing.tickets.push({ id: row.id, label: row.label, hasQr: row.hasQr });
      continue;
    }
    groups.set(row.filmId, {
      filmId: row.filmId,
      title: row.title,
      date: row.date,
      startTime: row.startTime,
      formats: row.formats,
      posterUrl: row.posterUrl,
      tickets: [{ id: row.id, label: row.label, hasQr: row.hasQr }],
    });
  }
  const all = [...groups.values()];
  const upcoming = all.filter((group) => !group.date || group.date >= today).sort(byScreening);
  const past = all.filter((group) => group.date && group.date < today).sort((a, b) => byScreening(b, a));
  return { upcoming, past };
}
