/** Ticket images are visible only to someone attending the fixed screening or
 * to someone who voted for the winning slot of a date poll. */
export function mayViewAdmissionTickets(input: {
  isDirectlyGoing: boolean;
  votedForWinningPollOption: boolean;
}) {
  return input.isDirectlyGoing || input.votedForWinningPollOption;
}

function amsterdamNow(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
}

/** Admission tickets stay in the wallet from the moment they are added until
 * the screening's end time in Amsterdam. After that they disappear. */
export function ticketWindowOpen(
  input: { date: string | null; endTime: string | null },
  now: Date
) {
  if (!input.date) return true;
  const clock = amsterdamNow(now);
  if (input.date > clock.date) return true;
  if (input.date < clock.date) return false;
  return (input.endTime || "23:59") >= clock.time;
}

export type WalletTicketRow = {
  id: number;
  label: string;
  hasQr: boolean;
  filmId: number;
  title: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
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
  endTime: string | null;
  formats: string | null;
  posterUrl: string | null;
  tickets: { id: number; label: string; hasQr: boolean }[];
};

function byScreening(a: WalletGroup, b: WalletGroup) {
  return (a.date || "9999").localeCompare(b.date || "9999") || a.filmId - b.filmId;
}

/** Group live admission tickets by film. Screenings that have ended are omitted. */
export function buildTicketWallet(rows: WalletTicketRow[], now: Date) {
  const groups = new Map<number, WalletGroup>();
  for (const row of rows) {
    if (!mayViewAdmissionTickets({
      isDirectlyGoing: row.isDirectlyGoing,
      votedForWinningPollOption: row.votedForWinningPollOption,
    })) continue;
    if (!ticketWindowOpen(row, now)) continue;
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
      endTime: row.endTime,
      formats: row.formats,
      posterUrl: row.posterUrl,
      tickets: [{ id: row.id, label: row.label, hasQr: row.hasQr }],
    });
  }
  const upcoming = [...groups.values()].sort(byScreening);
  return { upcoming, past: [] as WalletGroup[] };
}
