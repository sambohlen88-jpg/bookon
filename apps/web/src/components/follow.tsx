export const NETWORK_NAMES = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
} as const;

/** BookOn's social accounts, once an admin has added them (Admin, Settings). */
export function Follow({
  links,
  tone,
}: {
  links: Partial<Record<keyof typeof NETWORK_NAMES, string>>;
  tone: "hero" | "page";
}) {
  const entries = (Object.keys(NETWORK_NAMES) as (keyof typeof NETWORK_NAMES)[]).filter(
    (n) => links[n],
  );
  if (entries.length === 0) return null;
  const pill =
    tone === "hero"
      ? "flex min-h-10 items-center rounded-full border border-hero-fg/30 px-4 text-sm font-medium hover:border-hero-fg"
      : "flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-medium hover:border-brand";
  return (
    <div
      className={
        tone === "hero"
          ? "mt-6 flex flex-wrap items-center gap-2"
          : "mt-6 flex flex-wrap items-center gap-2"
      }
    >
      <span className={`mr-1 text-sm ${tone === "hero" ? "text-hero-muted" : "text-muted"}`}>
        Follow BookOn
      </span>
      {entries.map((n) => (
        <a key={n} href={links[n]} target="_blank" rel="noopener" className={pill}>
          {NETWORK_NAMES[n]}
        </a>
      ))}
    </div>
  );
}
