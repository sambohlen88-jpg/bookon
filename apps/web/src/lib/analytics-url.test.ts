import { describe, expect, it } from "vitest";
import { urlEvents } from "./analytics-url";

const q = (s: string) => new URLSearchParams(s);

describe("actions read from the address", () => {
  it("counts a new sort and filters on search results", () => {
    expect(urlEvents("/search", q("date=2026-11-01&sort=price&area=north&lat=-32"), null)).toEqual([
      { name: "sort", label: "price" },
      { name: "filter", label: "area" },
      { name: "near_me", label: "search" },
    ]);
  });

  it("doesn't count the same sort again on the next page", () => {
    const before = { path: "/search", params: q("sort=price&date=2026-11-01") };
    expect(urlEvents("/search", q("sort=price&date=2026-11-02"), before)).toEqual([]);
    expect(urlEvents("/search", q("sort=rating&date=2026-11-02"), before)).toEqual([
      { name: "sort", label: "rating" },
    ]);
  });

  it("counts changing day on a tee sheet, not arriving on it", () => {
    expect(urlEvents("/courses/collier-park", q("day=2026-11-01"), null)).toEqual([]);
    expect(
      urlEvents("/courses/collier-park", q("day=2026-11-02"), {
        path: "/courses/collier-park",
        params: q("day=2026-11-01"),
      }),
    ).toEqual([{ name: "tee_sheet_day", label: null }]);
  });
});
