import "server-only";
import { clickSigningKey, createClickToken, readClickToken, type ClickTarget } from "@bookon/core";

export { createClickToken, readClickToken, type ClickTarget };

let warned = false;

/**
 * The link for a Book button: tracked through /go when a key is configured.
 * Without one in production, golfers still reach the club, just untracked.
 */
export function bookLink(target: ClickTarget, key = clickSigningKey()): string {
  if (!key) {
    if (!warned)
      console.error("[go] CLICK_SIGNING_SECRET is not set, so Book clicks are not tracked");
    warned = true;
    return target.url;
  }
  return `/go/${createClickToken(target, key)}`;
}
