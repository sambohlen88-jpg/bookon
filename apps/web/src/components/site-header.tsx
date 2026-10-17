import Link from "next/link";
import { InstallPrompt } from "@/components/install-prompt";
import { currentUser } from "@/lib/auth";

const navLink = "text-sm font-medium text-foreground hover:text-brand";

/**
 * Phones: the name and an account link, as before. Desktop: a full site
 * header with the logo and main pages.
 */
export async function SiteHeader() {
  const user = await currentUser().catch(() => null);
  return (
    <>
      <header className="md:border-b md:border-border">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 pt-4 md:max-w-6xl md:px-6 md:py-4">
          <Link
            href="/"
            className="flex items-center gap-3 text-xl font-bold tracking-tight text-brand md:text-2xl"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/icon.svg"
              alt=""
              width={40}
              height={40}
              className="hidden size-10 md:block"
            />
            BookOn
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
            <Link href="/" className={navLink}>
              Find a tee time
            </Link>
            <Link href="/courses" className={navLink}>
              Courses
            </Link>
            <Link href="/clubs" className={navLink}>
              For golf clubs
            </Link>
          </nav>
          <Link
            href={user ? "/account" : "/signin"}
            className="flex min-h-11 items-center text-sm font-medium text-brand md:rounded-lg md:border md:border-border md:px-4"
          >
            {user ? "My account" : "Sign in"}
          </Link>
        </div>
      </header>
      <InstallPrompt />
    </>
  );
}
