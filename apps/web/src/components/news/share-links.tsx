"use client";

import { useState } from "react";
import { track } from "@/lib/analytics-client";

const pill =
  "flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-medium hover:border-brand";

/** Share an article (Milestone 24): plain links to each site, so nothing loads from them until tapped. */
export function ShareLinks({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const links = [
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { name: "X", href: `https://x.com/intent/post?url=${u}&text=${t}` },
    { name: "WhatsApp", href: `https://wa.me/?text=${t}%20${u}` },
    { name: "Email", href: `mailto:?subject=${t}&body=${u}` },
  ];
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      track("share", "article");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // No clipboard: the address bar still has the link.
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm text-muted">Share</span>
      {links.map((l) => (
        <a
          key={l.name}
          href={l.href}
          target={l.name === "Email" ? undefined : "_blank"}
          rel="noopener noreferrer"
          onClick={() => track("share", "article")}
          className={pill}
        >
          {l.name}
        </a>
      ))}
      <button type="button" onClick={copy} className={pill}>
        {copied ? "Link copied" : "Copy link"}
      </button>
    </div>
  );
}
