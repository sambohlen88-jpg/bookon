import { RATING_MIN_COUNT, type RatingSummary } from "./ratings";

/**
 * Sorting courses (Milestone 20), for search results and the Courses page.
 * No server code here: the Courses page sorts in the browser.
 */

export type SortChoice = "soonest" | "name" | "price" | "available" | "rating" | "near";

export const SORT_LABEL: Record<SortChoice, string> = {
  soonest: "Soonest",
  name: "A to Z",
  price: "Cheapest",
  available: "Most available",
  rating: "Top rated",
  near: "Nearest",
};

/** What a course is sorted on. */
export interface SortFacts {
  name: string;
  /** The earliest free time, as milliseconds, or null when nothing is free. */
  firstStart: number | null;
  /** The cheapest free time's price, or null when nothing free shows a price. */
  cheapestCents: number | null;
  /** Free times that fit. */
  freeTimes: number;
  rating: RatingSummary | null | undefined;
  /** Kilometres away, on a Near me search. */
  km: number | null;
}

const last = Number.POSITIVE_INFINITY;

function bySoonest(a: SortFacts, b: SortFacts): number {
  return (a.firstStart ?? last) - (b.firstStart ?? last);
}

function rated(f: SortFacts): RatingSummary | null {
  return f.rating && f.rating.count >= RATING_MIN_COUNT ? f.rating : null;
}

const compare: Record<SortChoice, (a: SortFacts, b: SortFacts) => number> = {
  soonest: bySoonest,
  name: (a, b) => a.name.localeCompare(b.name),
  // Clubs that don't show prices go after those that do.
  price: (a, b) => (a.cheapestCents ?? last) - (b.cheapestCents ?? last) || bySoonest(a, b),
  available: (a, b) => b.freeTimes - a.freeTimes || bySoonest(a, b),
  // Courses with too few ratings to show an average go after rated ones.
  rating: (a, b) => {
    const ra = rated(a);
    const rb = rated(b);
    if (ra && rb) return rb.average - ra.average || rb.count - ra.count || bySoonest(a, b);
    if (ra || rb) return ra ? -1 : 1;
    return bySoonest(a, b);
  },
  near: (a, b) => (a.km ?? last) - (b.km ?? last) || bySoonest(a, b),
};

/**
 * Sort a copy of `items`. With `freeFirst` (search results), courses with
 * nothing free stay at the bottom whatever the sort, in name order.
 */
export function sortCourses<T>(
  items: T[],
  sort: SortChoice,
  facts: (item: T) => SortFacts,
  options: { freeFirst?: boolean } = {},
): T[] {
  const withFacts = items.map((item) => ({ item, f: facts(item) }));
  withFacts.sort((x, y) => {
    if (options.freeFirst) {
      const free = Number(y.f.freeTimes > 0) - Number(x.f.freeTimes > 0);
      if (free) return free;
      if (x.f.freeTimes === 0) return x.f.name.localeCompare(y.f.name);
    }
    return compare[sort](x.f, y.f) || x.f.name.localeCompare(y.f.name);
  });
  return withFacts.map((x) => x.item);
}

/** The cheapest price among times, or null when none shows one. */
export function cheapestCents(times: { priceCents: number | null }[]): number | null {
  const prices = times.map((t) => t.priceCents).filter((p): p is number => p !== null);
  return prices.length > 0 ? Math.min(...prices) : null;
}

export function isSortChoice(value: unknown): value is SortChoice {
  return typeof value === "string" && value in SORT_LABEL;
}
