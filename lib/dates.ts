const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True for a YYYY-MM-DD string that is a real calendar day. The shape alone is
 * not enough: 2026-13-45 makes the calendar feed throw for everyone attending
 * that film, and JavaScript quietly rolls 2026-02-31 over to March.
 */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
