/** Parse a ticket label such as "Zaal 6 · Rij 8 · Seats 12-14". */
export function parseTicketLabel(label: string) {
  const hall = /\b(?:zaal|hall|screen)\s*([a-z0-9]+)/i.exec(label)?.[1] ?? null;
  const row = /\b(?:row|rij)\s*([a-z0-9]+)/i.exec(label)?.[1] ?? null;
  const seatsRaw = /\b(?:seats?|stoelen?|stoel)\s*([a-z0-9]+(?:\s*[-–—]\s*[a-z0-9]+)?(?:\s*[,/&]\s*[a-z0-9]+)*)/i.exec(label)?.[1] ?? null;
  const seats = seatsRaw ? seatsRaw.replace(/\s+/g, "").replace(/[-–—]/g, "–") : null;
  return { hall, row, seats, count: countSeats(seats) };
}

function countSeats(seats: string | null) {
  if (!seats) return null;
  const range = /^(\d+)–(\d+)$/.exec(seats);
  if (range) {
    const from = Number(range[1]);
    const to = Number(range[2]);
    if (Number.isInteger(from) && Number.isInteger(to) && to >= from) return to - from + 1;
  }
  if (/[,/]/.test(seats)) return seats.split(/[,/]/).filter(Boolean).length;
  return 1;
}

export function admitCopy(count: number | null) {
  if (!count || count <= 1) return "Admit one";
  if (count === 2) return "Admit two";
  return `Admit ${count}`;
}
