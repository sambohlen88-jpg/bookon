import Link from "next/link";
import { SORT_LABEL, type SortChoice } from "@bookon/core/sorting";

const chip =
  "flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap";

/** A row of sort choices as links (Milestone 20), so the order is part of the page address. */
export function SortBar({
  choices,
  current,
  href,
}: {
  choices: SortChoice[];
  current: SortChoice;
  href: (choice: SortChoice) => string;
}) {
  return (
    <nav
      aria-label="Sort"
      className="-mx-4 mt-4 flex items-center gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0"
    >
      <span className="shrink-0 text-sm text-muted">Sort</span>
      {choices.map((c) => (
        <Link
          key={c}
          href={href(c)}
          scroll={false}
          aria-current={c === current ? "true" : undefined}
          className={`${chip} ${c === current ? "border-brand bg-brand text-brand-foreground" : "border-border"}`}
        >
          {SORT_LABEL[c]}
        </Link>
      ))}
    </nav>
  );
}
