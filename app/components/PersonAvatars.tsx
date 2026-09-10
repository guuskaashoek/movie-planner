export type Person = {
  id: number;
  name: string | null;
  /** Absent on poll voters coming through the board discovery helpers. */
  email?: string;
  image: string | null;
};

const SIZES = {
  xs: "h-5 w-5 text-[8px]",
  sm: "h-6 w-6 text-[9px]",
  md: "h-8 w-8 text-[11px]",
} as const;

export function personLabel(person: Person) {
  return person.name || person.email || "Someone";
}

/**
 * A row of overlapping profile photos, with initials for members who never set
 * one. Used wherever the board hints at who is going or who liked a film.
 */
export function PersonAvatars({
  people,
  max = 5,
  size = "sm",
  tone = "default",
  caption,
  className = "",
}: {
  people: Person[];
  max?: number;
  size?: keyof typeof SIZES;
  tone?: "default" | "on-media";
  caption?: string;
  className?: string;
}) {
  if (people.length === 0) return null;

  const shown = people.slice(0, max);
  const hidden = people.length - shown.length;
  const names = people.map(personLabel);
  const box = SIZES[size];
  const ring = tone === "on-media" ? "ring-black/50" : "ring-zinc-950";
  const captionClass = tone === "on-media" ? "text-white/80" : "text-zinc-500";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex -space-x-1.5" role="img" aria-label={names.join(", ")} title={names.join(", ")}>
        {shown.map((person) => (
          <div key={person.id} className={`${box} flex-none rounded-full ring-2 ${ring}`}>
            {person.image ? (
              <img
                src={person.image}
                alt=""
                loading="lazy"
                className="h-full w-full rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full bg-zinc-700 font-bold text-white">
                {personLabel(person)[0].toUpperCase()}
              </div>
            )}
          </div>
        ))}
        {hidden > 0 && (
          <div
            className={`${box} flex flex-none items-center justify-center rounded-full bg-zinc-800 font-bold text-zinc-300 ring-2 ${ring}`}
          >
            +{hidden}
          </div>
        )}
      </div>
      {caption && <span className={`text-xs ${captionClass}`}>{caption}</span>}
    </div>
  );
}
