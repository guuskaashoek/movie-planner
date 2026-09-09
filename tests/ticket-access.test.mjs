import { test } from "node:test";
import assert from "node:assert/strict";
import { mayViewAdmissionTickets } from "../lib/ticket-access.ts";

test("ticket access requires attendance", () => {
  assert.equal(mayViewAdmissionTickets({ isDirectlyGoing: false, votedForWinningPollOption: false }), false);
  assert.equal(mayViewAdmissionTickets({ isDirectlyGoing: true, votedForWinningPollOption: false }), true);
  assert.equal(mayViewAdmissionTickets({ isDirectlyGoing: false, votedForWinningPollOption: true }), true);
});

test("an unrelated poll vote does not reveal tickets", () => {
  assert.equal(mayViewAdmissionTickets({ isDirectlyGoing: false, votedForWinningPollOption: false }), false);
});
