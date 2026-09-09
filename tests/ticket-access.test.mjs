import { test } from "node:test";
import assert from "node:assert/strict";
import { mayViewAdmissionTickets, buildTicketWallet, ticketWindowOpen } from "../lib/ticket-access.ts";
import { admitCopy, parseTicketLabel } from "../lib/ticket-label.ts";

test("ticket access requires attendance", () => {
  assert.equal(mayViewAdmissionTickets({ isDirectlyGoing: false, votedForWinningPollOption: false }), false);
  assert.equal(mayViewAdmissionTickets({ isDirectlyGoing: true, votedForWinningPollOption: false }), true);
  assert.equal(mayViewAdmissionTickets({ isDirectlyGoing: false, votedForWinningPollOption: true }), true);
});

test("an unrelated poll vote does not reveal tickets", () => {
  assert.equal(mayViewAdmissionTickets({ isDirectlyGoing: false, votedForWinningPollOption: false }), false);
});

test("ticket labels accept a seat range", () => {
  assert.deepEqual(parseTicketLabel("Row 8 · Seats 12-14"), { row: "8", seats: "12–14", count: 3 });
  assert.deepEqual(parseTicketLabel("Rij 8 stoel 12"), { row: "8", seats: "12", count: 1 });
  assert.equal(admitCopy(3), "Admit 3");
  assert.equal(admitCopy(1), "Admit one");
});

test("wallet groups visible tickets by film and hides the rest", () => {
  const now = new Date("2026-09-09T08:00:00Z");
  const row = (id, filmId, going, extra = {}) => ({
    id,
    label: `Seat ${id}`,
    hasQr: true,
    filmId,
    title: filmId === 1 ? "Dune" : "Other",
    date: "2026-09-20",
    startTime: "20:00",
    endTime: "23:00",
    formats: null,
    posterUrl: null,
    isDirectlyGoing: going,
    votedForWinningPollOption: false,
    ...extra,
  });
  const wallet = buildTicketWallet([
    row(1, 1, true),
    row(2, 1, true),
    row(3, 2, false),
    row(4, 3, false, { date: "2026-09-01", title: "Past", isDirectlyGoing: true }),
  ], now);
  assert.deepEqual(wallet.upcoming.map((group) => [group.filmId, group.tickets.map((ticket) => ticket.id)]), [[1, [1, 2]]]);
  assert.deepEqual(wallet.past.map((group) => group.filmId), []);
});

test("tickets hide after the screening end time in Amsterdam", () => {
  const during = new Date("2026-09-09T08:00:00Z");
  const after = new Date("2026-09-09T21:30:00Z");
  assert.equal(ticketWindowOpen({ date: "2026-09-09", endTime: "23:00" }, during), true);
  assert.equal(ticketWindowOpen({ date: "2026-09-09", endTime: "23:00" }, after), false);
  assert.equal(ticketWindowOpen({ date: "2026-09-10", endTime: "22:00" }, after), true);
});
