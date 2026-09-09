"use client";

import Link from "next/link";
import { FilmQuickActions } from "@/app/components/FilmQuickActions";
import { discoverFilms, goingTo, ticketState } from "@/lib/board-discovery";
import type { Film } from "./BoardClient";
import "./discovery.css";

function day(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function metaLine(film: Film) {
  const bits: string[] = [];
  if (film.date) bits.push(`${day(film.date)}${film.startTime ? ` · ${film.startTime}` : ""}`);
  else if (film.releaseDate) bits.push(`In cinemas ${day(film.releaseDate)}`);
  if (film.formats) bits.push(film.formats.split(",").filter(Boolean).join(" · "));
  return bits.join("  ·  ");
}

export function BoardSpotlight({
  films,
  now,
  preview = false,
  onLike,
  onGoing,
}: {
  films: Film[];
  now: Date;
  preview?: boolean;
  onLike: (film: Film) => Promise<void>;
  onGoing: (film: Film) => Promise<void>;
}) {
  const { featured, tickets, withFriends } = discoverFilms(films, now);
  const href = (film: Film) => (preview ? `/preview?film=${film.id}` : `/film/${film.id}`);
  if (!featured) return null;

  const crowd = goingTo(featured);
  const status = ticketState(featured, now);
  const artwork = featured.backdropUrl || featured.posterUrl;
  const friends = withFriends.filter((film) => film.id !== featured.id);
  const ticketFilms = tickets.filter((film) => film.id !== featured.id);

  return (
    <div className="discovery">
      <section
        className={`feature-film ${artwork ? "" : "feature-film-empty"}`}
        aria-labelledby="featured-title"
      >
        {artwork && (
          <img
            className="feature-art"
            src={artwork}
            alt=""
            fetchPriority="high"
            referrerPolicy="no-referrer"
          />
        )}
        <div className="feature-shade" />
        <div className="feature-body">
          <h1 id="featured-title">{featured.title}</h1>
          <p className="feature-line">
            {metaLine(featured)}
            {crowd.length > 0 ? `  ·  ${crowd.length} going` : ""}
          </p>
          {status !== "unknown" && (
            <p className="feature-tickets">
              {status === "open"
                ? "Tickets on sale now"
                : `Tickets ${day(featured.ticketsOnSaleDate!)}${featured.ticketsOnSaleTime ? ` · ${featured.ticketsOnSaleTime}` : ""}`}
              {featured.ticketsUrl ? (
                <>
                  {" · "}
                  <a href={featured.ticketsUrl} target="_blank" rel="noopener noreferrer">
                    Buy
                  </a>
                </>
              ) : null}
            </p>
          )}
          {(featured.admissionTicketCount ?? 0) > 0 && (
            <p className="feature-tickets">
              We have tickets for this screening
              {featured.isGoing ? (
                <>
                  {" · "}
                  <Link href={preview ? "/preview/tickets" : "/tickets"}>Open</Link>
                </>
              ) : null}
            </p>
          )}
          <div className="feature-actions">
            <Link className="discovery-primary" href={href(featured)}>
              {featured.poll ? "Pick a date" : "Open"}
            </Link>
            <FilmQuickActions
              title={featured.title}
              liked={featured.isInterested}
              going={featured.isGoing}
              hasScreening={!!featured.date}
              hasPoll={!!featured.poll}
              likes={featured.interestedUsers.length}
              goingCount={crowd.length}
              href={href(featured)}
              onLike={() => onLike(featured)}
              onGoing={() => onGoing(featured)}
              compact
              tone="on-media"
            />
          </div>
        </div>
      </section>

      {friends.length > 0 && (
        <section className="poster-section" aria-labelledby="crew-heading">
          <div className="section-head">
            <h2 id="crew-heading">Friends are going</h2>
          </div>
          <div className="poster-rail">
            {friends.map((film) => (
              <Link key={film.id} href={href(film)} className="poster-card">
                <div className="poster-art">
                  {(film.posterUrl || film.backdropUrl) && (
                    <img
                      src={film.posterUrl || film.backdropUrl!}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <span>{goingTo(film).length} going</span>
                </div>
                <h3>{film.title}</h3>
                <p>
                  {film.date
                    ? `${day(film.date)}${film.startTime ? ` · ${film.startTime}` : ""}`
                    : "Pick a date"}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {ticketFilms.length > 0 && (
        <section className="poster-section" aria-labelledby="ticket-heading">
          <div className="section-head">
            <h2 id="ticket-heading">Tickets</h2>
          </div>
          <div className="ticket-rail">
            {ticketFilms.map((film) => {
              const state = ticketState(film, now);
              return (
                <Link key={film.id} href={href(film)} className="sale-card">
                  <div className="sale-art">
                    {(film.posterUrl || film.backdropUrl) && (
                      <img
                        src={film.posterUrl || film.backdropUrl!}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                  <div className="sale-copy">
                    <strong>
                      {day(film.ticketsOnSaleDate!)}
                      {film.ticketsOnSaleTime ? ` · ${film.ticketsOnSaleTime}` : ""}
                    </strong>
                    <h3>{film.title}</h3>
                    <span>{state === "open" ? "Sales started" : "On sale"}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
