import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="mx-auto flex max-w-md items-center px-4 pt-4">
      <Link href="/" className="text-xl font-bold tracking-tight text-brand">
        BookOn
      </Link>
    </header>
  );
}
