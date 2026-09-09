import type { Film } from "@/app/board/BoardClient";

export function previewFilms(now: Date): Film[] {
  const date = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);
  const people = ["Guus", "Sam", "Mila", "Alex"].map((name, index) => ({ id: index + 1, name, email: `${name.toLowerCase()}@example.com`, image: null }));
  const base: Film = { id: 1, title: "", description: null, date: date(7), releaseDate: null, startTime: "20:00", endTime: "23:00", posterUrl: null, backdropUrl: null, isMajorRelease: false, formats: "IMAX", ticketsOnSaleDate: null, ticketsOnSaleTime: null, ticketsUrl: null, inviteToken: null, goingUsers: [], interestedUsers: [], isGoing: false, isInterested: false, canRate: false, myRating: null, averageRating: null, ratingCount: 0, poll: null };
  return [
    { ...base, id: 1, title: "Dune: Part Two", description: "Some films deserve the biggest screen you can find. Back to Arrakis, together. This is our kind of movie night.", posterUrl: "/preview/dune.webp", backdropUrl: "/preview/dune-backdrop.webp", isMajorRelease: true, formats: "IMAX,70MM", date: date(12), ticketsOnSaleDate: date(1), ticketsOnSaleTime: "10:00", ticketsUrl: "https://www.pathe.nl", goingUsers: people.slice(0, 3), interestedUsers: people },
    { ...base, id: 2, title: "Interstellar", description: "One more journey beyond the stars. A big-screen rewatch with the crew.", posterUrl: "/preview/interstellar.webp", date: date(5), ticketsOnSaleDate: date(-2), ticketsOnSaleTime: "12:00", goingUsers: people, interestedUsers: people.slice(0, 2) },
    { ...base, id: 3, title: "Oppenheimer", description: "Three hours. One extraordinary cinema experience.", posterUrl: "/preview/oppenheimer.webp", date: date(9), ticketsOnSaleDate: date(3), ticketsOnSaleTime: "09:00", goingUsers: people.slice(0, 2), interestedUsers: people.slice(0, 3), formats: "70MM" },
    { ...base, id: 4, title: "Spider-Man: Across the Spider-Verse", description: "Every frame is worth the trip.", posterUrl: "/preview/spiderverse.webp", date: date(15), formats: "DOLBY", interestedUsers: people.slice(0, 2) },
    { ...base, id: 5, title: "Inception", description: "A film worth getting lost in, all over again.", posterUrl: "/preview/inception.webp", date: date(18), interestedUsers: people.slice(0, 1) },
  ];
}
