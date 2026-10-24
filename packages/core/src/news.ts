/**
 * BookOn News (Milestone 24): categories, article addresses, and the small
 * formatting language articles are written in. Articles are parsed into
 * plain building blocks (never raw HTML), so nothing in an article can run
 * code on the site.
 */

export const NEWS_CATEGORIES = {
  "course-news": "Course news",
  tips: "Tips and how-to",
  competitions: "Competitions",
  "around-perth": "Around Perth",
  gear: "Gear",
} as const;
export type NewsCategory = keyof typeof NEWS_CATEGORIES;

export function isNewsCategory(value: unknown): value is NewsCategory {
  return typeof value === "string" && Object.hasOwn(NEWS_CATEGORIES, value);
}

export const NEWS_PAGE_SIZE = 12;
export const NEWS_TITLE_MAX = 120;
export const NEWS_SUMMARY_MAX = 240;
export const NEWS_BODY_MAX = 40_000;

/** "Summer golf in Perth: beating the heat" → "summer-golf-in-perth-beating-the-heat". */
export function slugify(title: string): string {
  return (
    title
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/g, "") || "article"
  );
}

/* The formatting language: a small, safe part of Markdown. */

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "link"; href: string; external: boolean; children: Inline[] };

export type Block =
  | { type: "p"; children: Inline[] }
  | { type: "h2"; children: Inline[] }
  | { type: "h3"; children: Inline[] }
  | { type: "ul"; items: Inline[][] }
  | { type: "ol"; items: Inline[][] }
  | { type: "quote"; children: Inline[] }
  | { type: "img"; src: string; alt: string; caption: string | null };

/** Pictures can only come from BookOn: uploaded news pictures and the drawn course art. */
export function safeImageSrc(src: string): string | null {
  if (/^\/news-photos\/[0-9a-f-]{36}$/i.test(src)) return src;
  if (/^\/art\/[a-z0-9-]{1,60}(-wide)?\.svg$/.test(src)) return src;
  return null;
}

/** Links go to web pages, email, or BookOn's own pages. Nothing else (no javascript:). */
export function safeHref(href: string): { href: string; external: boolean } | null {
  const h = href.trim();
  if (/^\/(?!\/)[^\s]*$/.test(h)) return { href: h, external: false };
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(h)) return { href: h, external: false };
  try {
    const url = new URL(h);
    if (url.protocol === "https:" || url.protocol === "http:")
      return { href: url.toString(), external: true };
  } catch {
    // Not a link.
  }
  return null;
}

/** Bold, italics and links within a line. Anything not understood stays as plain text. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let plain = "";
  const flush = () => {
    if (plain) out.push({ type: "text", text: plain });
    plain = "";
  };
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    const strong = /^\*\*(.+?)\*\*/.exec(rest);
    if (strong) {
      flush();
      out.push({ type: "strong", children: parseInline(strong[1]!) });
      i += strong[0].length;
      continue;
    }
    const em = /^[*_]([^*_\s][^*_]*?)[*_]/.exec(rest);
    if (em && (i === 0 || /[\s(]/.test(text[i - 1]!))) {
      flush();
      out.push({ type: "em", children: parseInline(em[1]!) });
      i += em[0].length;
      continue;
    }
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest);
    if (link) {
      const safe = safeHref(link[2]!);
      if (safe) {
        flush();
        out.push({ type: "link", ...safe, children: parseInline(link[1]!) });
        i += link[0].length;
        continue;
      }
    }
    plain += text[i];
    i++;
  }
  flush();
  return out;
}

/**
 * An article's text into blocks. Blank lines separate paragraphs.
 * "## " and "### " are headings, "- " and "1. " lists, "> " quotes, and
 * ![description](picture "caption") a picture on its own line.
 */
export function parseArticle(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  let quote: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: "p", children: parseInline(para.join(" ")) });
    if (list) blocks.push({ type: list.type, items: list.items.map(parseInline) });
    if (quote.length) blocks.push({ type: "quote", children: parseInline(quote.join(" ")) });
    para = [];
    list = null;
    quote = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({
        type: heading[1]!.length === 3 ? "h3" : "h2",
        children: parseInline(heading[2]!),
      });
      continue;
    }
    const image = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/.exec(line);
    if (image) {
      const src = safeImageSrc(image[2]!);
      flush();
      if (src)
        blocks.push({ type: "img", src, alt: image[1]!.trim(), caption: image[3]?.trim() || null });
      continue;
    }
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.+)$/.exec(line);
    if (bullet || numbered) {
      const type = bullet ? "ul" : "ol";
      if (para.length || quote.length || (list && list.type !== type)) flush();
      list ??= { type, items: [] };
      list.items.push((bullet ?? numbered)![1]!);
      continue;
    }
    const quoted = /^>\s?(.*)$/.exec(line);
    if (quoted) {
      if (para.length || list) flush();
      quote.push(quoted[1]!);
      continue;
    }
    if (list || quote.length) flush();
    para.push(line);
  }
  flush();
  return blocks;
}

function inlineText(nodes: Inline[]): string {
  return nodes.map((n) => (n.type === "text" ? n.text : inlineText(n.children))).join("");
}

/** The words of an article, without formatting: for reading time and search previews. */
export function articleText(markdown: string): string {
  return parseArticle(markdown)
    .map((b) =>
      b.type === "img"
        ? (b.caption ?? "")
        : b.type === "ul" || b.type === "ol"
          ? b.items.map(inlineText).join(" ")
          : inlineText(b.children),
    )
    .filter(Boolean)
    .join("\n");
}

/** Minutes to read, at about 220 words a minute. At least 1. */
export function readingMinutes(markdown: string): number {
  const words = articleText(markdown).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** Pictures used in an article, for checking they all have descriptions. */
export function articleImages(markdown: string): { src: string; alt: string }[] {
  return parseArticle(markdown)
    .filter((b): b is Extract<Block, { type: "img" }> => b.type === "img")
    .map((b) => ({ src: b.src, alt: b.alt }));
}
