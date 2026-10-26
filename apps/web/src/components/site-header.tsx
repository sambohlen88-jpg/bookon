import Link from "next/link";
import { Suspense } from "react";
import { HeaderNav, type AccountLink } from "@/components/header-nav";
import { InstallPrompt } from "@/components/install-prompt";
import { currentAccess } from "@/lib/access";
import { LATEST_BAY_TIME, defaultForm, searchHref } from "@/lib/search-form";
import { siteNav } from "@/lib/site-nav";

/**
 * The site header (Milestone 25): the logo (home, where the search is), the
 * menu, and the areas this person can open. It stays at the top while
 * scrolling, so the menu is always a tap away.
 */
export async function SiteHeader() {
  const { user, admin, clubs, coach, author } = await currentAccess();
  const now = new Date();
  const account: AccountLink[] = [
    ...(admin ? [{ href: "/admin", label: "Admin" }] : []),
    ...(clubs > 0 ? [{ href: "/club", label: "My club" }] : []),
    ...(coach ? [{ href: "/coach", label: "My coaching" }] : []),
    ...(author && !admin ? [{ href: "/write", label: "Write" }] : []),
  ];
  const sections = siteNav({
    baysHref: searchHref({ ...defaultForm(now), play: "bays", to: LATEST_BAY_TIME }),
  });
  return (
    <>
      {/* Solid, not frosted: a blur would trap the menus' full-screen layers inside the header. */}
      <header className="sticky top-0 z-40 border-b border-border bg-background print:hidden">
        <div className="mx-auto flex h-[var(--header-height)] max-w-[1440px] items-center justify-between gap-4 px-4 md:px-6 lg:px-10">
          <Link
            href="/"
            aria-label="BookOn, home"
            className="flex shrink-0 items-center gap-3 text-xl font-bold tracking-tight text-brand lg:text-2xl"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon.svg" alt="" width={36} height={36} className="size-8 lg:size-9" />
            BookOn
          </Link>
          <Suspense>
            <HeaderNav sections={sections} account={account} signedIn={Boolean(user)} />
          </Suspense>
        </div>
      </header>
      <InstallPrompt />
    </>
  );
}
