import { describe, expect, it } from "vitest";
import { parseArticleForm, parsePublishAt } from "./news-form";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe("the article form", () => {
  it("keeps only the cover that was chosen", () => {
    const input = parseArticleForm(
      form({
        title: "T",
        summary: "S",
        body: "B",
        coverKind: "art",
        coverArt: "collier-park",
        coverPhotoId: "x",
        coverAlt: "Drawn",
      }),
    );
    expect(input).toMatchObject({
      coverArt: "collier-park",
      coverPhotoId: null,
      coverAlt: "Drawn",
      category: null,
    });
    expect(parseArticleForm(form({ coverKind: "none", coverAlt: "x" })).coverAlt).toBeNull();
  });

  it("reads a Perth publish time", () => {
    expect(
      parsePublishAt(form({ publishDate: "2026-10-30", publishTime: "06:00" }))?.toISOString(),
    ).toBe("2026-10-29T22:00:00.000Z");
    expect(parsePublishAt(form({ publishDate: "soon" }))).toBeNull();
  });
});
