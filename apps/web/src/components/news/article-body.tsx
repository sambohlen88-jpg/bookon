import { parseArticle, type Inline } from "@bookon/core/news";

/**
 * An article's text as page elements (Milestone 24). Built from parsed
 * blocks, never raw HTML, so nothing in an article can run on the site.
 * Used on article pages and in the editor's preview.
 */
function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) =>
        n.type === "text" ? (
          n.text
        ) : n.type === "strong" ? (
          <strong key={i}>
            <Inlines nodes={n.children} />
          </strong>
        ) : n.type === "em" ? (
          <em key={i}>
            <Inlines nodes={n.children} />
          </em>
        ) : (
          <a
            key={i}
            href={n.href}
            className="font-medium text-brand underline underline-offset-2"
            {...(n.external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
          >
            <Inlines nodes={n.children} />
          </a>
        ),
      )}
    </>
  );
}

export function ArticleBody({ markdown }: { markdown: string }) {
  const blocks = parseArticle(markdown);
  return (
    <div className="flex flex-col gap-5 text-lg leading-relaxed">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "h2":
            return (
              <h2 key={i} className="mt-4 text-2xl font-bold tracking-tight">
                <Inlines nodes={b.children} />
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} className="mt-2 text-xl font-semibold">
                <Inlines nodes={b.children} />
              </h3>
            );
          case "p":
            return (
              <p key={i}>
                <Inlines nodes={b.children} />
              </p>
            );
          case "ul":
          case "ol": {
            const List = b.type;
            return (
              <List
                key={i}
                className={`flex flex-col gap-2 pl-6 ${b.type === "ul" ? "list-disc" : "list-decimal"}`}
              >
                {b.items.map((item, j) => (
                  <li key={j}>
                    <Inlines nodes={item} />
                  </li>
                ))}
              </List>
            );
          }
          case "quote":
            return (
              <blockquote
                key={i}
                className="border-l-4 border-brand pl-4 text-xl italic text-muted"
              >
                <Inlines nodes={b.children} />
              </blockquote>
            );
          case "img":
            return (
              <figure key={i} className="my-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.src}
                  alt={b.alt}
                  loading="lazy"
                  className="w-full rounded-xl bg-surface"
                />
                {b.caption && (
                  <figcaption className="mt-2 text-sm text-muted">{b.caption}</figcaption>
                )}
              </figure>
            );
        }
      })}
    </div>
  );
}
