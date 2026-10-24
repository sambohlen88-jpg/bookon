import type { AnalyticsEventName } from "@bookon/core/analytics";

/**
 * Actions read from a page's address (Milestone 23): the search's sort and
 * filters, and a tee sheet's day, which are links rather than buttons.
 * Only what changed since the last page counts, so paging through doesn't.
 */
export function urlEvents(
  path: string,
  params: URLSearchParams,
  previous: { path: string; params: URLSearchParams } | null,
): { name: AnalyticsEventName; label: string | null }[] {
  const changed = (key: string) =>
    params.has(key) &&
    params.get(key) !== "" &&
    (previous?.path !== path || previous.params.get(key) !== params.get(key));
  const events: { name: AnalyticsEventName; label: string | null }[] = [];
  if (path === "/search") {
    if (changed("sort")) events.push({ name: "sort", label: params.get("sort") });
    if (changed("area")) events.push({ name: "filter", label: "area" });
    if (changed("mine")) events.push({ name: "filter", label: "favourites" });
    if (changed("course")) events.push({ name: "filter", label: "courses" });
    if (changed("lat")) events.push({ name: "near_me", label: "search" });
  }
  if (/^\/courses\/[^/]+$/.test(path) && changed("day") && previous?.path === path)
    events.push({ name: "tee_sheet_day", label: null });
  return events;
}
