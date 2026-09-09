import Link from "next/link";
import type { WalletGroup } from "@/lib/ticket-access";
import { CinemaTicket } from "./CinemaTicket";
import "./tickets.css";

function flatten(groups: WalletGroup[]) {
  return groups.flatMap((group) => group.tickets.map((ticket) => ({ group, ticket })));
}

export function TicketsWallet({
  upcoming,
  past,
  preview = false,
}: {
  upcoming: WalletGroup[];
  past: WalletGroup[];
  preview?: boolean;
}) {
  const total = upcoming.reduce((sum, group) => sum + group.tickets.length, 0)
    + past.reduce((sum, group) => sum + group.tickets.length, 0);
  const filmHref = (id: number) => (preview ? `/preview?film=${id}` : `/film/${id}`);
  const boardHref = preview ? "/preview" : "/board";

  return (
    <div className="ticket-wallet page-frame">
      <h1>Tickets</h1>
      <p className="ticket-wallet-count">
        {total === 0 ? "Your cinema wallet" : `${total} ${total === 1 ? "ticket" : "tickets"}`}
      </p>

      {total === 0 ? (
        <div className="ticket-empty">
          <strong>No tickets yet</strong>
          <p>
            Tickets appear here after you mark I’m going on a screening.{" "}
            <Link href={boardHref}>Back to films</Link>
          </p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="ticket-section" aria-labelledby="upcoming-tickets">
              <h2 id="upcoming-tickets">Upcoming</h2>
              <div className="ticket-wallet-list">
                {flatten(upcoming).map(({ group, ticket }) => (
                  <CinemaTicket
                    key={ticket.id}
                    filmId={group.filmId}
                    title={group.title}
                    date={group.date}
                    startTime={group.startTime}
                    formats={group.formats}
                    label={ticket.label}
                    ticketId={ticket.id}
                    posterUrl={group.posterUrl}
                    qrSrc={preview ? "/preview/sample-qr.svg" : `/api/films/${group.filmId}/tickets/${ticket.id}/qr`}
                    filmHref={filmHref(group.filmId)}
                    photoHref={preview ? undefined : `/api/films/${group.filmId}/tickets/${ticket.id}`}
                  />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section className="ticket-section" aria-labelledby="past-tickets">
              <h2 id="past-tickets">Past</h2>
              <div className="ticket-wallet-list">
                {flatten(past).map(({ group, ticket }) => (
                  <CinemaTicket
                    key={ticket.id}
                    filmId={group.filmId}
                    title={group.title}
                    date={group.date}
                    startTime={group.startTime}
                    formats={group.formats}
                    label={ticket.label}
                    ticketId={ticket.id}
                    posterUrl={group.posterUrl}
                    qrSrc={preview ? "/preview/sample-qr.svg" : `/api/films/${group.filmId}/tickets/${ticket.id}/qr`}
                    filmHref={filmHref(group.filmId)}
                    photoHref={preview ? undefined : `/api/films/${group.filmId}/tickets/${ticket.id}`}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
