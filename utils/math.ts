export interface record {
  totalTicketsUsed: number;
  totalTicketsBought: number;
  totalFreeTickets: number;
}

export function calculatePayableTickets(
  prevTournament: {
    rolloverTickets: number;
    rolloverRatio: number;
  },
  currTournament: record,
) {
  const prevPaidTicketsLeft =
    prevTournament.rolloverTickets * prevTournament.rolloverRatio;

  const prevFreeTickets =
    prevTournament.rolloverTickets * (1 - prevTournament.rolloverRatio);

  const currPaidTickets =
    currTournament.totalTicketsBought + prevPaidTicketsLeft;

  const currFreeTickets = currTournament.totalFreeTickets + prevFreeTickets;

  const currPayableRatio =
    currPaidTickets / (currPaidTickets + currFreeTickets);

  const payableTickets = currPayableRatio * currTournament.totalTicketsUsed;

  const rolloverTickets =
    currPaidTickets + currPayableRatio - currTournament.totalTicketsUsed;
  const rolloverRatio = currPayableRatio;

  return {
    payableTickets: payableTickets,
    rolloverTickets: rolloverTickets,
    rolloverRatio: rolloverRatio,
  };
}
