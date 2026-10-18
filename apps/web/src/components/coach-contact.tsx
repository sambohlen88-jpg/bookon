"use client";

/** A contact button that counts the tap for the coach, then opens WhatsApp, email or the phone. */
export function ContactLink({
  slug,
  method,
  href,
  label,
  primary = false,
  external = false,
}: {
  slug: string;
  method: "whatsapp" | "email" | "phone" | "website";
  href: string;
  label: string;
  primary?: boolean;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener" } : {})}
      onClick={() => {
        try {
          navigator.sendBeacon(
            "/api/coaches/contact",
            new Blob([JSON.stringify({ slug, method })], { type: "application/json" }),
          );
        } catch {
          // Counting is a nice-to-have; the link still opens.
        }
      }}
      className={`flex min-h-12 items-center justify-center gap-2 rounded-lg px-4 text-base font-semibold ${
        primary
          ? "bg-brand text-brand-foreground"
          : "border border-border text-foreground hover:border-brand"
      }`}
    >
      {label}
    </a>
  );
}
