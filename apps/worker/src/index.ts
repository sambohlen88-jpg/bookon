/**
 * BookOn background worker. Runs separately from the web app so slow club
 * fetches never slow the site (SPEC section 5).
 *
 * Milestone 0: no adapters are registered. Availability polling arrives in
 * Milestone 1 and alert matching in Milestone 4.
 */
import type { CourseAdapter } from "@bookon/core";

const adapters: CourseAdapter[] = [];

function main() {
  console.log(`[worker] started with ${adapters.length} adapters registered`);
  if (adapters.length === 0) {
    console.log("[worker] nothing to poll yet, exiting");
  }
}

main();
