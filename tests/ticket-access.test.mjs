import { test } from "node:test";
import assert from "node:assert/strict";
import { mayViewAdmissionTickets, buildTicketWallet } from "../lib/ticket-access.ts";
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
  const row = (id, filmId, going, extra = {}) => ({
    id,
    label: `Seat ${id}`,
    hasQr: true,
    filmId,
    title: filmId === 1 ? "Dune" : "Other",
    date: "2026-09-20",
    startTime: "20:00",
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
  ], "2026-09-09");
  assert.deepEqual(wallet.upcoming.map((group) => [group.filmId, group.tickets.map((ticket) => ticket.id)]), [[1, [1, 2]]]);
  assert.deepEqual(wallet.past.map((group) => group.filmId), [3]);
});
