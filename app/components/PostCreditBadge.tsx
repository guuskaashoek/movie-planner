import { postCreditBadge, type PostCreditSource } from "@/lib/post-credits";

/** Quiet status chip. Unknown is only a "?", so unchecked films stay out of the way. */
export function PostCreditBadge({
  film,
  className = "",
}: {
  film: PostCreditSource;
  className?: string;
}) {
  const badge = postCreditBadge(film);
  const tone =
    badge.tone === "yes"
      ? "rounded-md border border-lime-200/25 bg-lime-200/10 px-2 py-0.5 text-[10px] font-medium leading-snug text-lime-100"
      : badge.tone === "none"
        ? "rounded-md border border-zinc-700 bg-zinc-900/80 px-2 py-0.5 text-[10px] font-medium leading-snug text-zinc-400"
        : "rounded-md border border-zinc-800 px-2 py-0.5 text-[10px] font-medium leading-snug text-zinc-500";

  return (
    <span
      className={`post-credit-badge inline-block max-w-full whitespace-normal ${tone} ${className}`}
      data-tone={badge.tone}
      title={badge.title}
      aria-label={badge.title}
    >
      {badge.label}
    </span>
  );
}
