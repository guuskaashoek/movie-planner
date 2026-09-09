const TOKEN = String.raw`[:.\-–—]?\s*(?:nr\.?|no\.?|#)?\s*`;
const SEAT_CHUNK = String.raw`[a-z0-9]+(?:\s*(?:[-–—]|t\/m|tot(?:\s+en\s+met)?)\s*[a-z0-9]+)?(?:\s*[,/&]\s*[a-z0-9]+)*`;

/** Parse a ticket label such as "Zaal 6 · Rij 8 · Seats 12-14". */
export function parseTicketLabel(label: string) {
  const hall = pick(label, String.raw`\b(?:zaal|hall|screens?|salle)\b${TOKEN}([a-z0-9]+)`);
  const row = pick(label, String.raw`\b(?:row|rij|rang|fila)\b${TOKEN}([a-z0-9]+)`);
  const seats = normaliseSeats(pick(label, String.raw`\b(?:seats|seat|stoelen|stoel|plaatsen|plaats)\b${TOKEN}(${SEAT_CHUNK})`));
  return { hall, row, seats, count: countSeats(seats) };
}

function pick(label: string, pattern: string) {
  return new RegExp(pattern, "i").exec(label)?.[1] ?? null;
}

function normaliseSeats(raw: string | null) {
  if (!raw) return null;
  return raw
    .replace(/\s+/g, "")
    .replace(/t\/m/gi, "–")
    .replace(/totenmet/gi, "–")
    .replace(/[-–—]/g, "–");
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
