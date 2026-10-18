"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { href: "/", label: "Find", icon: "search", match: (p: string) => p === "/" || p === "/search" },
  {
    href: "/courses",
    label: "Courses",
    icon: "flag",
    match: (p: string) => p.startsWith("/courses"),
  },
  {
    href: "/account?tab=alerts",
    label: "Alerts",
    icon: "bell",
    match: (p: string, tab: string | null) => p === "/account" && tab === "alerts",
  },
  {
    href: "/account",
    label: "Account",
    icon: "person",
    match: (p: string, tab: string | null) =>
      (p === "/account" && tab !== "alerts") || p === "/signin",
  },
] as const;

/**
 * The menu bar along the bottom of the screen on phones, like an app. Admin
 * and club pages have their own menus, so it stays off those.
 */
export function PhoneTabs() {
  const path = usePathname();
  const tab = useSearchParams().get("tab");
  if (path.startsWith("/admin") || path.startsWith("/club/") || path === "/club") return null;
  return (
    <nav
      aria-label="Menu"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map((t) => {
          const active = t.match(path, tab);
          return (
            <li key={t.label}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${active ? "text-brand" : "text-muted"}`}
              >
                <Icon name={t.icon} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Icon({ name }: { name: (typeof TABS)[number]["icon"] }) {
  const paths: Record<typeof name, React.ReactNode> = {
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </>
    ),
    flag: (
      <>
        <path d="M6 21V4" />
        <path d="M6 4l11 4-11 4" />
        <path d="M3 21h9" />
      </>
    ),
    bell: (
      <>
        <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" />
        <path d="M10 20a2 2 0 0 0 4 0" />
      </>
    ),
    person: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
