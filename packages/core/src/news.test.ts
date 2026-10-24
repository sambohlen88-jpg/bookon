import { describe, expect, it } from "vitest";
import { articleText, parseArticle, parseInline, readingMinutes, safeHref, slugify } from "./news";

describe("article addresses", () => {
  it("makes short, readable slugs", () => {
    expect(slugify("Summer golf in Perth: beating the heat")).toBe(
      "summer-golf-in-perth-beating-the-heat",
    );
    expect(slugify("Tips & tricks for Rottnest — café edition!")).toBe(
      "tips-and-tricks-for-rottnest-cafe-edition",
    );
    expect(slugify("!!!")).toBe("article");
  });
});

describe("the formatting language", () => {
  it("reads headings, paragraphs, lists, quotes and pictures", () => {
    const blocks = parseArticle(
      [
        "## Before you go",
        "Book **early** and bring *water*.",
        "It's hot.",
        "",
        "- Hat",
        "- Sunscreen",
        "",
        "1. Warm up",
        "2. Tee off",
        "",
        "> Golf is a game of misses.",
        "",
        '![Collier Park drawn](/art/collier-park-wide.svg "Collier Park")',
      ].join("\n"),
    );
    expect(blocks.map((b) => b.type)).toEqual(["h2", "p", "ul", "ol", "quote", "img"]);
    expect(blocks[1]).toEqual({
      type: "p",
      children: [
        { type: "text", text: "Book " },
        { type: "strong", children: [{ type: "text", text: "early" }] },
        { type: "text", text: " and bring " },
        { type: "em", children: [{ type: "text", text: "water" }] },
        { type: "text", text: ". It's hot." },
      ],
    });
    expect(blocks[5]).toEqual({
      type: "img",
      src: "/art/collier-park-wide.svg",
      alt: "Collier Park drawn",
      caption: "Collier Park",
    });
  });

  it("only links to web pages, email and BookOn pages", () => {
    expect(parseInline("[Book](/search)")[0]).toMatchObject({
      type: "link",
      href: "/search",
      external: false,
    });
    expect(parseInline("[WA Golf](https://golf.org.au)")[0]).toMatchObject({ external: true });
    // Unsafe links stay as plain text.
    expect(parseInline("[x](javascript:alert(1))")).toEqual([
      { type: "text", text: "[x](javascript:alert(1))" },
    ]);
    expect(safeHref("//evil.example")).toBeNull();
    expect(safeHref("data:text/html,hi")).toBeNull();
  });

  it("drops pictures from anywhere but BookOn, and keeps HTML as plain text", () => {
    expect(parseArticle("![x](https://example.com/a.jpg)")).toEqual([]);
    expect(parseArticle("<script>alert(1)</script>")).toEqual([
      { type: "p", children: [{ type: "text", text: "<script>alert(1)</script>" }] },
    ]);
  });

  it("works out reading time from the words", () => {
    const words = Array.from({ length: 660 }, () => "golf").join(" ");
    expect(readingMinutes(words)).toBe(3);
    expect(readingMinutes("Short.")).toBe(1);
    expect(articleText("## Hi\n\n- **one**\n- two")).toBe("Hi\none two");
  });
});
