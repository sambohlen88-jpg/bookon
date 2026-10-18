"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Side navigation for an area (admin or a club's login), highlighting where you are. */
export function AreaNav({
  label,
  links,
}: {
  label: string;
  links: { href: string; label: string; badge?: number; exact?: boolean }[];
}) {
  const path = usePathname();
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex gap-1 md:flex-col">
        {links.map((l) => {
          const active = l.exact
            ? path === l.href
            : path === l.href || path.startsWith(`${l.href}/`);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-10 items-center justify-between gap-3 whitespace-nowrap rounded-lg px-3 text-sm ${active ? "bg-surface font-semibold text-brand" : "text-muted hover:text-foreground"}`}
              >
                {l.label}
                {l.badge ? (
                  <span className="rounded-full bg-brand px-2 text-xs font-semibold text-brand-foreground">
                    {l.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
