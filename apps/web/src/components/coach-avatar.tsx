/** A coach's approved photo, or their initials when they haven't added one. */
export function CoachAvatar({
  name,
  photoId,
  size = "md",
}: {
  name: string;
  photoId: string | null;
  size?: "md" | "lg";
}) {
  const box = size === "lg" ? "size-24 text-3xl md:size-32 md:text-4xl" : "size-16 text-xl";
  if (photoId)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/coach-photos/${photoId}.webp`}
        alt=""
        loading="lazy"
        className={`${box} shrink-0 rounded-full object-cover`}
      />
    );
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 2)
    .join("");
  return (
    <span
      aria-hidden
      className={`${box} flex shrink-0 items-center justify-center rounded-full bg-brand font-bold text-brand-foreground`}
    >
      {initials}
    </span>
  );
}

/** "PGA Professional" once BookOn has checked it; the Sample badge on made-up coaches. */
export function CoachBadges({ pgaVerified, sample }: { pgaVerified: boolean; sample: boolean }) {
  if (!pgaVerified && !sample) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {pgaVerified && (
        <span className="inline-flex items-center gap-1 rounded-full border border-brand px-2 py-0.5 text-xs font-medium text-brand">
          <span aria-hidden>✓</span> PGA Professional
        </span>
      )}
      {sample && (
        <span className="inline-flex items-center rounded-full border border-warning-border bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning-fg">
          Sample profile
        </span>
      )}
    </span>
  );
}
