/** Ticket images are visible only to someone attending the fixed screening or
 * to someone who voted for the winning slot of a date poll. */
export function mayViewAdmissionTickets(input: {
  isDirectlyGoing: boolean;
  votedForWinningPollOption: boolean;
}) {
  return input.isDirectlyGoing || input.votedForWinningPollOption;
}
