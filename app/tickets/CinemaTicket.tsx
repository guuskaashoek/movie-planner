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
  endTime,
  formats,
  label,
  ticketId,
  qrSrc,
  filmHref,
  posterUrl,
}: {
  filmId: number;
  title: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  formats: string | null;
  label: string;
  ticketId: number;
  qrSrc: string;
  filmHref: string;
  posterUrl?: string | null;
}) {
  const parsed = parseTicketLabel(label);
  const format = formats?.split(",")[0]?.trim() || "Cinema";
  const when = [
    date ? formatDay(date) : null,
    startTime ? `${startTime}${endTime ? ` – ${endTime}` : ""}` : null,
  ].filter(Boolean).join(" · ");
  const order = `MP-${String(filmId).padStart(2, "0")}${String(ticketId).padStart(3, "0")}`;
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
        <p className="cinema-ticket-when">{when || "Time to be announced"}</p>
      </div>
      <div className="cinema-ticket-perf" aria-hidden="true" />
      <div className="cinema-ticket-stub">
        <img className="ticket-qr" src={qrSrc} alt={`QR code for ${title}, ${label}`} />
        {parsed.hall || parsed.row || parsed.seats ? (
          <div className="cinema-ticket-place">
            <div>
              <span>Hall</span>
              <strong>{parsed.hall ?? "—"}</strong>
            </div>
            <div>
              <span>Row</span>
              <strong>{parsed.row ?? "—"}</strong>
            </div>
            <div>
              <span>{parsed.count && parsed.count > 1 ? "Seats" : "Seat"}</span>
              <strong>{parsed.seats ?? "—"}</strong>
            </div>
          </div>
        ) : (
          <div className="cinema-ticket-place cinema-ticket-place-guest">
            <div>
              <span>Guest</span>
              <strong>{label}</strong>
            </div>
          </div>
        )}
        <p className="cinema-ticket-order">{order}</p>
      </div>
    </article>
  );
}
