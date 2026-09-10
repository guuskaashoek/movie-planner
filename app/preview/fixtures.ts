import type { Film } from "@/app/board/BoardClient";
import { buildTicketWallet } from "@/lib/ticket-access";

export function previewFilms(now: Date): Film[] {
  const date = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);
  // Inline portraits keep the preview offline while still showing real photos.
  const portrait = (hue: number) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="hsl(${hue} 45% 32%)"/><circle cx="32" cy="24" r="11" fill="hsl(${hue} 45% 78%)"/><circle cx="32" cy="60" r="19" fill="hsl(${hue} 45% 78%)"/></svg>`)}`;
  // Alex has no photo, so the preview also covers the initials fallback.
  const people = ["Guus", "Sam", "Mila", "Alex"].map((name, index) => ({ id: index + 1, name, email: `${name.toLowerCase()}@example.com`, image: index === 3 ? null : portrait(90 + index * 70) }));
  const base: Film = { id: 1, title: "", description: null, date: date(7), releaseDate: null, startTime: "20:00", endTime: "23:00", posterUrl: null, backdropUrl: null, isMajorRelease: false, formats: "IMAX", ticketsOnSaleDate: null, ticketsOnSaleTime: null, ticketsUrl: null, admissionTicketCount: 0, inviteToken: null, goingUsers: [], interestedUsers: [], isGoing: false, isInterested: false, canRate: false, myRating: null, averageRating: null, ratingCount: 0, poll: null };
  return [
    { ...base, id: 1, title: "Dune: Part Two", description: "Some films deserve the biggest screen you can find. Back to Arrakis, together. This is our kind of movie night.", posterUrl: "/preview/dune.webp", backdropUrl: "/preview/dune-backdrop.webp", isMajorRelease: true, formats: "IMAX,70MM", date: date(12), ticketsOnSaleDate: date(1), ticketsOnSaleTime: "10:00", ticketsUrl: "https://www.pathe.nl", admissionTicketCount: 2, goingUsers: people.slice(0, 3), interestedUsers: people },
    { ...base, id: 2, title: "Interstellar", description: "One more journey beyond the stars. A big-screen rewatch with the crew.", posterUrl: "/preview/interstellar.webp", date: date(5), ticketsOnSaleDate: date(-2), ticketsOnSaleTime: "12:00", admissionTicketCount: 1, goingUsers: people, interestedUsers: people.slice(0, 2) },
    { ...base, id: 3, title: "Oppenheimer", description: "Three hours. One extraordinary cinema experience.", posterUrl: "/preview/oppenheimer.webp", date: date(9), ticketsOnSaleDate: date(3), ticketsOnSaleTime: "09:00", goingUsers: people.slice(0, 2), interestedUsers: people.slice(0, 3), formats: "70MM" },
    { ...base, id: 4, title: "Spider-Man: Across the Spider-Verse", description: "Every frame is worth the trip.", posterUrl: "/preview/spiderverse.webp", date: date(15), formats: "DOLBY", interestedUsers: people.slice(0, 2) },
    { ...base, id: 5, title: "Inception", description: "A film worth getting lost in, all over again.", posterUrl: "/preview/inception.webp", date: date(18), interestedUsers: people.slice(0, 1) },
  ];
}

export function previewTickets(now: Date) {
  const films = previewFilms(now);
  const dune = films[0];
  const interstellar = films[1];
  return buildTicketWallet(
    [
      {
        id: 1,
        label: "Row 8 · Seats 12-14",
        hasQr: true,
        filmId: dune.id,
        title: dune.title,
        date: dune.date,
        startTime: dune.startTime,
        endTime: dune.endTime,
        formats: dune.formats,
        posterUrl: dune.posterUrl,
        isDirectlyGoing: true,
        votedForWinningPollOption: false,
      },
      {
        id: 2,
        label: "Guus",
        hasQr: true,
        filmId: dune.id,
        title: dune.title,
        date: dune.date,
        startTime: dune.startTime,
        endTime: dune.endTime,
        formats: dune.formats,
        posterUrl: dune.posterUrl,
        isDirectlyGoing: true,
        votedForWinningPollOption: false,
      },
      {
        id: 3,
        label: "Row 4 · Seat 9",
        hasQr: true,
        filmId: interstellar.id,
        title: interstellar.title,
        date: interstellar.date,
        startTime: interstellar.startTime,
        endTime: interstellar.endTime,
        formats: interstellar.formats,
        posterUrl: interstellar.posterUrl,
        isDirectlyGoing: true,
        votedForWinningPollOption: false,
      },
    ],
    now
  );
}
