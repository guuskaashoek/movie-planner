import Link from "next/link";
import { admitCopy, parseTicketLabel } from "@/lib/ticket-label";
import "./tickets.css";

function formatDay(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function CinemaTicket({
  filmId,
  title,
  date,
  startTime,
  formats,
  label,
  ticketId,
  qrSrc,
  filmHref,
  photoHref,
  posterUrl,
}: {
  filmId: number;
  title: string;
  date: string | null;
  startTime: string | null;
  formats: string | null;
  label: string;
  ticketId: number;
  qrSrc: string;
  filmHref: string;
  photoHref?: string;
  posterUrl?: string | null;
}) {
  const parsed = parseTicketLabel(label);
  const format = formats?.split(",")[0]?.trim() || "Cinema";
  return (
    <article className="cinema-ticket">
      {posterUrl && (
        <div className="cinema-ticket-poster">
          <img src={posterUrl} alt="" referrerPolicy="no-referrer" />
        </div>
      )}
      <div className="cinema-ticket-body">
        <div className="cinema-ticket-brand">
          <span>{admitCopy(parsed.count)}</span>
          <span>{format}</span>
        </div>
        <h3>
          <Link href={filmHref}>{title}</Link>
        </h3>
        <dl className="cinema-ticket-meta">
          <div>
            <dt>Date</dt>
            <dd>{date ? formatDay(date) : "TBA"}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>{startTime || "TBA"}</dd>
          </div>
          <div>
            <dt>No.</dt>
            <dd>MP-{String(filmId).padStart(2, "0")}{String(ticketId).padStart(3, "0")}</dd>
          </div>
        </dl>
      </div>
      <div className="cinema-ticket-perf" aria-hidden="true" />
      <div className="cinema-ticket-stub">
        <img className="ticket-qr" src={qrSrc} alt={`QR code for ${title}, ${label}`} />
        <div className="cinema-ticket-seat">
          {parsed.row || parsed.seats ? (
            <>
              {parsed.row && (
                <div>
                  <span>Row</span>
                  <strong>{parsed.row}</strong>
                </div>
              )}
              {parsed.seats && (
                <div>
                  <span>{parsed.count && parsed.count > 1 ? "Seats" : "Seat"}</span>
                  <strong>{parsed.seats}</strong>
                </div>
              )}
            </>
          ) : (
            <div>
              <span>Guest</span>
              <strong>{label}</strong>
            </div>
          )}
        </div>
        {photoHref && (
          <a className="cinema-ticket-photo" href={photoHref} target="_blank" rel="noopener noreferrer">
            Original photo
          </a>
        )}
      </div>
    </article>
  );
}
