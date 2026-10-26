import { describe, expect, it } from "vitest";
import { siteNav } from "./site-nav";

describe("the site menu", () => {
  const sections = siteNav({ baysHref: "/search?play=bays" });

  it("has the five sections, each with links, and no Find a tee time at the top level", () => {
    expect(sections.map((s) => s.label)).toEqual([
      "Courses",
      "Competitions",
      "Coaching",
      "News",
      "For golf clubs",
    ]);
    for (const s of sections) expect(s.groups.flatMap((g) => g.links).length).toBeGreaterThan(0);
  });

  it("only links to BookOn's own pages, each once per section", () => {
    for (const s of sections) {
      const hrefs = s.groups.flatMap((g) => g.links.map((l) => l.href));
      expect(new Set(hrefs).size).toBe(hrefs.length);
      for (const h of hrefs) expect(h.startsWith("/")).toBe(true);
    }
  });
});
