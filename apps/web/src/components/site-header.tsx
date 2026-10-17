import Link from "next/link";
import { InstallPrompt } from "@/components/install-prompt";
import { currentUser } from "@/lib/auth";

export async function SiteHeader() {
  const user = await currentUser().catch(() => null);
  return (
    <>
      <header className="mx-auto flex max-w-md items-center justify-between px-4 pt-4">
        <Link href="/" className="text-xl font-bold tracking-tight text-brand">
          BookOn
        </Link>
        <Link
          href={user ? "/account" : "/signin"}
          className="flex min-h-11 items-center text-sm font-medium text-brand"
        >
          {user ? "My account" : "Sign in"}
        </Link>
      </header>
      <InstallPrompt />
    </>
  );
}
