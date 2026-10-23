import Link from "next/link";

const heading = "text-sm font-semibold";
const link = "text-sm text-muted hover:text-brand";

/** On every page. Says who runs BookOn and that bookings are made with the club. */
export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-border bg-surface print:hidden">
      <div className="mx-auto grid max-w-md gap-8 px-4 py-8 md:max-w-6xl md:grid-cols-[2fr_1fr_1fr] md:px-6 md:py-12">
        <div>
          <p className="flex items-center gap-3 text-xl font-bold tracking-tight text-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon.svg" alt="" width={32} height={32} className="size-8" />
            BookOn
          </p>
          <p className="mt-3 max-w-sm text-sm text-muted">
            Every Perth and WA public course we check, in one search. Times and prices come from
            each club&apos;s booking page. You book and pay with the club.
          </p>
        </div>
        <nav aria-label="Golfers">
          <p className={heading}>Golfers</p>
          <ul className="mt-3 flex flex-col gap-2">
            <li>
              <Link href="/" className={link}>
                Find a tee time
              </Link>
            </li>
            <li>
              <Link href="/courses" className={link}>
                Courses
              </Link>
            </li>
            <li>
              <Link href="/competitions" className={link}>
                Competitions
              </Link>
            </li>
            <li>
              <Link href="/coaches" className={link}>
                Find a coach
              </Link>
            </li>
            <li>
              <Link href="/golf" className={link}>
                Golf in Perth
              </Link>
            </li>
            <li>
              <Link href="/account" className={link}>
                My account and alerts
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <p className={heading}>Golf clubs</p>
          <ul className="mt-3 flex flex-col gap-2">
            <li>
              <Link href="/clubs" className={link}>
                For golf clubs
              </Link>
            </li>
            <li>
              <Link href="/clubs/join" className={link}>
                List your club
              </Link>
            </li>
          </ul>
          <p className={`${heading} mt-6`}>Coaches</p>
          <ul className="mt-3 flex flex-col gap-2">
            <li>
              <Link href="/coaching" className={link}>
                List your coaching
              </Link>
            </li>
          </ul>
          <p className={`${heading} mt-6`}>Contact</p>
          <ul className="mt-3 flex flex-col gap-2">
            <li>
              <a href="mailto:info@bookon.com.au" className={link}>
                info@bookon.com.au
              </a>
            </li>
            <li className="text-sm text-muted">Perth, Western Australia</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
