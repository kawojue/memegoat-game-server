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
  const rolloverRatio = prevTournament.rolloverRatio / 1e6;

  const prevPaidTicketsLeft = prevTournament.rolloverTickets * rolloverRatio;

  const prevFreeTickets = prevTournament.rolloverTickets * (1 - rolloverRatio);

  const currPaidTickets =
    currTournament.totalTicketsBought + prevPaidTicketsLeft;

  const currFreeTickets = currTournament.totalFreeTickets + prevFreeTickets;

  const currPayableRatio =
    currPaidTickets / (currPaidTickets + currFreeTickets);

  const payableTickets = currPayableRatio * currTournament.totalTicketsUsed;

  const rolloverTickets =
    currPaidTickets + currFreeTickets - currTournament.totalTicketsUsed;

  return {
    payableTickets: payableTickets,
    rolloverTickets: rolloverTickets,
    rolloverRatio: currPayableRatio,
  };
}
