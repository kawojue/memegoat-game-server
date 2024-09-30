export interface record {
  totalTicketsUsed: number;
  totalTicketsBought: number;
  totalFreeTickets: number;
}

export function calculatePayableTickets(
  prevTournament: record,
  currTournament: record,
) {
  const prevTicketsLeft =
    prevTournament.totalTicketsBought +
    prevTournament.totalFreeTickets -
    prevTournament.totalTicketsUsed;

  const prevPayableRatio =
    prevTournament.totalTicketsBought /
    (prevTournament.totalTicketsBought + prevTournament.totalFreeTickets);

  const prevPaidTicketsLeft = prevTicketsLeft * prevPayableRatio;

  const currPaidTickets =
    currTournament.totalTicketsBought + prevPaidTicketsLeft;

  const currFreeTickets =
    currTournament.totalFreeTickets + (prevTicketsLeft - prevPaidTicketsLeft);

  const currPayableRatio =
    currPaidTickets / (currPaidTickets + currFreeTickets);

  const payableTickets = currPayableRatio * currTournament.totalTicketsUsed;

  return payableTickets;
}
