"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { NavFeature, NavLink, NavSection } from "@/lib/site-nav";

export interface AccountLink {
  href: string;
  label: string;
}

const OPEN_DELAY_MS = 120;
const CLOSE_DELAY_MS = 220;

/**
 * The site menu (Milestone 25). Desktop: the five sections across the top;
 * hovering or clicking one drops an Apple-style panel down from the header,
 * the full width of the page, with the page behind dimmed. Phones and
 * tablets: a menu button that drops a full-screen menu down from the top,
 * where tapping a section slides across to its links.
 */
export function HeaderNav({
  sections,
  account,
  signedIn,
}: {
  sections: NavSection[];
  /** Admin, My club, My coaching, Write: only those this person has. */
  account: AccountLink[];
  signedIn: boolean;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** How the open panel was opened: a click keeps it open until clicked again. */
  const via = useRef<"hover" | "click">("hover");
  const baseId = useId();
  const [features, setFeatures] = useState<NavFeature[]>([]);
  const fetched = useRef(false);
  // The featured event and article load the first time a menu opens.
  useEffect(() => {
    if (!open || fetched.current) return;
    fetched.current = true;
    fetch("/api/nav")
      .then((r) => (r.ok ? r.json() : []))
      .then((f: NavFeature[]) => setFeatures(f))
      .catch(() => {});
  }, [open]);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const close = useCallback(() => {
    clear();
    setOpen(null);
    setMobile(false);
  }, []);

  // Moving to another page closes everything.
  useEffect(() => close(), [pathname, params, close]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);
  // The page behind the phone menu doesn't scroll.
  useEffect(() => {
    document.documentElement.style.overflow = mobile ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [mobile]);

  /** Hover: open after a moment, or straight away when moving between sections. */
  const hoverOpen = (id: string) => {
    clear();
    via.current = "hover";
    if (open) setOpen(id);
    else timer.current = setTimeout(() => setOpen(id), OPEN_DELAY_MS);
  };
  const hoverClose = () => {
    clear();
    if (via.current === "click") return;
    timer.current = setTimeout(() => setOpen(null), CLOSE_DELAY_MS);
  };

  const active = (section: NavSection) =>
    section.groups.some((g) =>
      g.links.some((l) => l.href.split(/[?#]/)[0] === pathname && l.href !== "/"),
    );

  return (
    <>
      {/* Desktop: the sections, centred. */}
      <nav
        aria-label="Main"
        className="hidden flex-1 justify-center lg:flex"
        onMouseLeave={hoverClose}
      >
        <ul className="flex items-center gap-1 xl:gap-2">
          {sections.map((s) => {
            const panelId = `${baseId}-${s.id}`;
            const isOpen = open === s.id;
            return (
              <li key={s.id} onMouseEnter={() => hoverOpen(s.id)}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => {
                    clear();
                    // Hovering may have just opened it: a click then keeps it open.
                    const closing = isOpen && via.current === "click";
                    via.current = "click";
                    setOpen(closing ? null : s.id);
                  }}
                  className={`flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-medium transition-colors motion-reduce:transition-none xl:px-4 ${
                    isOpen
                      ? "bg-surface text-brand"
                      : active(s)
                        ? "text-brand"
                        : "text-foreground hover:text-brand"
                  }`}
                >
                  {s.label}
                  <svg
                    aria-hidden
                    viewBox="0 0 12 12"
                    className={`size-3 transition-transform motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`}
                  >
                    <path
                      d="M2.5 4.5 6 8l3.5-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <DesktopPanel
                  id={panelId}
                  section={s}
                  feature={features.find((f) => f.section === s.id)}
                  open={isOpen}
                  onEnter={clear}
                  onLeave={hoverClose}
                />
              </li>
            );
          })}
        </ul>
      </nav>
      {/* The page behind an open panel dims; clicking it closes the panel. */}
      <div
        aria-hidden
        onClick={close}
        className={`fixed inset-x-0 bottom-0 top-[var(--header-height)] z-30 hidden bg-foreground/20 backdrop-blur-[2px] transition-opacity duration-200 motion-reduce:transition-none lg:block ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Desktop: your areas and account, on the right. Narrower screens fold your areas into My account. */}
      <div className="hidden items-center gap-1 lg:flex">
        {account.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="hidden min-h-11 items-center rounded-full px-3 text-sm font-medium text-brand hover:bg-surface xl:flex"
          >
            {a.label}
          </Link>
        ))}
        {account.length > 0 ? <AccountMenu account={account} /> : null}
        <Link
          href={signedIn ? "/account" : "/signin"}
          className={`ml-1 min-h-11 items-center rounded-full border border-border px-4 text-sm font-medium text-brand hover:border-brand ${account.length > 0 ? "hidden xl:flex" : "flex"}`}
        >
          {signedIn ? "My account" : "Sign in"}
        </Link>
      </div>

      {/* Phones and tablets: the menu button. */}
      <button
        type="button"
        aria-expanded={mobile}
        aria-controls={`${baseId}-mobile`}
        aria-label={mobile ? "Close menu" : "Menu"}
        onClick={() => setMobile(!mobile)}
        className="relative flex size-11 items-center justify-center rounded-full hover:bg-surface lg:hidden"
      >
        <span
          aria-hidden
          className={`absolute h-0.5 w-5 rounded bg-foreground transition-transform duration-200 motion-reduce:transition-none ${mobile ? "rotate-45" : "-translate-y-1"}`}
        />
        <span
          aria-hidden
          className={`absolute h-0.5 w-5 rounded bg-foreground transition-transform duration-200 motion-reduce:transition-none ${mobile ? "-rotate-45" : "translate-y-1"}`}
        />
      </button>
      <MobileMenu
        id={`${baseId}-mobile`}
        open={mobile}
        sections={sections}
        account={account}
        signedIn={signedIn}
      />
    </>
  );
}

function PanelLink({ link }: { link: NavLink }) {
  return (
    <li>
      <Link href={link.href} className="group block rounded-lg py-1.5">
        <span className="text-base font-semibold text-foreground group-hover:text-brand">
          {link.label}
        </span>
        {link.hint && <span className="block text-sm text-muted">{link.hint}</span>}
      </Link>
    </li>
  );
}

function DesktopPanel({
  id,
  section,
  feature,
  open,
  onEnter,
  onLeave,
}: {
  id: string;
  section: NavSection;
  feature?: NavFeature;
  open: boolean;
  onEnter: () => void;
  onLeave: () => void;
}) {
  return (
    <div
      id={id}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      // Hidden panels are out of the tab order and away from screen readers.
      inert={!open}
      className={`absolute inset-x-0 top-full z-40 border-b border-border bg-background shadow-lg transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
        open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
      }`}
    >
      <div className="mx-auto flex max-w-[1440px] gap-16 px-6 py-8 lg:px-10">
        <div className="flex gap-16">
          {section.groups.map((g) => (
            <div key={g.title} className="min-w-48">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                {g.title}
              </p>
              <ul className="flex flex-col gap-1">
                {g.links.map((l) => (
                  <PanelLink key={l.href} link={l} />
                ))}
              </ul>
            </div>
          ))}
        </div>
        {feature && (
          <Link
            href={feature.href}
            className="ml-auto flex max-w-sm flex-col justify-center rounded-2xl bg-surface p-5 hover:ring-2 hover:ring-brand"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-brand">
              {feature.kicker}
            </span>
            <span className="mt-1 text-lg font-semibold leading-snug">{feature.title}</span>
          </Link>
        )}
      </div>
    </div>
  );
}

function MobileMenu({
  id,
  open,
  sections,
  account,
  signedIn,
}: {
  id: string;
  open: boolean;
  sections: NavSection[];
  account: AccountLink[];
  signedIn: boolean;
}) {
  const [section, setSection] = useState<string | null>(null);
  const shown = sections.find((s) => s.id === section);
  const first = useRef<HTMLButtonElement>(null);
  // Start at the top level each time it opens.
  useEffect(() => {
    if (open) {
      setSection(null);
      requestAnimationFrame(() => first.current?.focus());
    }
  }, [open]);
  const big =
    "flex min-h-14 w-full items-center justify-between text-2xl font-semibold tracking-tight";
  return (
    <div
      id={id}
      inert={!open}
      className={`fixed inset-x-0 bottom-0 top-[var(--header-height)] z-50 overflow-hidden bg-background transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none lg:hidden ${
        open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-4 opacity-0"
      }`}
    >
      <div
        className={`flex h-full w-[200%] transition-transform duration-300 ease-out motion-reduce:transition-none ${
          shown ? "-translate-x-1/2" : "translate-x-0"
        }`}
      >
        {/* Top level: the sections, then your areas. */}
        <nav
          aria-label="Site menu"
          inert={Boolean(shown)}
          className="h-full w-1/2 overflow-y-auto px-6 pb-24 pt-4"
        >
          <ul>
            {sections.map((s, i) => (
              <li key={s.id}>
                <button
                  ref={i === 0 ? first : undefined}
                  type="button"
                  onClick={() => setSection(s.id)}
                  className={big}
                >
                  {s.label}
                  <svg aria-hidden viewBox="0 0 12 12" className="size-4 text-muted">
                    <path
                      d="M4.5 2.5 8 6l-3.5 3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
          <ul className="mt-6 flex flex-col gap-1 border-t border-border pt-6">
            {account.map((a) => (
              <li key={a.href}>
                <Link
                  href={a.href}
                  className="flex min-h-11 items-center text-lg font-medium text-brand"
                >
                  {a.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={signedIn ? "/account" : "/signin"}
                className="flex min-h-11 items-center text-lg font-medium text-brand"
              >
                {signedIn ? "My account" : "Sign in"}
              </Link>
            </li>
          </ul>
        </nav>
        {/* A section's links. */}
        <div inert={!shown} className="h-full w-1/2 overflow-y-auto px-6 pb-24 pt-4">
          {shown && (
            <>
              <button
                type="button"
                onClick={() => setSection(null)}
                className="flex min-h-11 items-center gap-1 text-sm font-medium text-muted"
              >
                <svg aria-hidden viewBox="0 0 12 12" className="size-4">
                  <path
                    d="M7.5 2.5 4 6l3.5 3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Menu
              </button>
              <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-muted">
                {shown.label}
              </p>
              {shown.groups.map((g) => (
                <ul key={g.title} className="mt-3 flex flex-col">
                  {g.links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="flex min-h-12 items-center text-xl font-semibold tracking-tight"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Between 1024 and 1280 wide: My account, with your areas (Admin, My club…) in a small dropdown. */
function AccountMenu({ account }: { account: AccountLink[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={box} className="relative xl:hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-11 items-center gap-1 rounded-full border border-border px-4 text-sm font-medium text-brand hover:border-brand"
      >
        My account
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          className={`size-3 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <ul className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl border border-border bg-background p-2 shadow-lg">
          {[...account, { href: "/account", label: "My account" }].map((a) => (
            <li key={a.href}>
              <Link
                href={a.href}
                className="flex min-h-10 items-center rounded-lg px-3 text-sm font-medium hover:bg-surface hover:text-brand"
              >
                {a.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
