/** Pure selection rules shared by the board and its local preview. */
export type DiscoveryFilm = {
  id: number;
  date: string | null;
  releaseDate: string | null;
  endTime: string | null;
  isMajorRelease?: boolean;
  ticketsOnSaleDate: string | null;
  ticketsOnSaleTime: string | null;
  goingUsers: { id: number; name: string | null; image: string | null }[];
  interestedUsers: { id: number }[];
  poll: { options: { isWinning: boolean; voters: { id: number; name: string | null; image: string | null }[] }[] } | null;
};

export function amsterdamClock(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
}

export function goingTo(film: DiscoveryFilm) {
  const people = film.poll ? film.poll.options.find(option => option.isWinning)?.voters ?? [] : film.goingUsers;
  return [...new Map(people.map(person => [person.id, person])).values()];
}

export function ticketState(film: DiscoveryFilm, now: Date): "scheduled" | "open" | "unknown" {
  if (!film.ticketsOnSaleDate) return "unknown";
  const clock = amsterdamClock(now);
  if (film.ticketsOnSaleDate > clock.date) return "scheduled";
  if (film.ticketsOnSaleDate < clock.date) return "open";
  // A date alone does not promise that sales have already started today.
  if (!film.ticketsOnSaleTime) return "scheduled";
  return film.ticketsOnSaleTime <= clock.time ? "open" : "scheduled";
}

export function discoverFilms<T extends DiscoveryFilm>(films: T[], now: Date) {
  const clock = amsterdamClock(now);
  const upcoming = films.filter(f => f.date
    ? f.date > clock.date || (f.date === clock.date && (!f.endTime || f.endTime > clock.time))
    : !f.releaseDate || f.releaseDate >= clock.date);
  const byDate = (a: T, b: T) => (a.date || a.releaseDate || "9999").localeCompare(b.date || b.releaseDate || "9999") || a.id - b.id;
  const ranked = [...upcoming].sort((a, b) => Number(!!b.isMajorRelease) - Number(!!a.isMajorRelease)
    || Number(goingTo(b).length >= 2) - Number(goingTo(a).length >= 2)
    || goingTo(b).length - goingTo(a).length
    || b.interestedUsers.length - a.interestedUsers.length || byDate(a, b));
  const tickets = upcoming.filter(f => f.ticketsOnSaleDate).sort((a, b) => {
    const aFuture = ticketState(a, now) === "scheduled";
    const bFuture = ticketState(b, now) === "scheduled";
    return Number(bFuture) - Number(aFuture) || `${a.ticketsOnSaleDate} ${a.ticketsOnSaleTime ?? ""}`.localeCompare(`${b.ticketsOnSaleDate} ${b.ticketsOnSaleTime ?? ""}`) || byDate(a, b);
  });
  const withFriends = upcoming.filter(f => goingTo(f).length >= 2).sort((a, b) => goingTo(b).length - goingTo(a).length || byDate(a, b));
  return { featured: ranked[0] ?? null, tickets: tickets.slice(0, 4), withFriends: withFriends.slice(0, 6) };
}
