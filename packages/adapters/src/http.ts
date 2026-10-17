import type { HttpClient } from "@bookon/core";

/**
 * Fetches pages the way SPEC section 6 asks: one request at a time per host
 * with a gap between them, an honest user agent, a timeout, back-off on
 * errors, and robots.txt respected.
 */

export interface PoliteHttpOptions {
  /** Must name the product and give a contact, e.g. "BookOnBot/0.1 (+https://bookon.com.au; hello@bookon.com.au)". */
  userAgent: string;
  /** Minimum gap between requests to the same host. */
  minIntervalMs?: number;
  timeoutMs?: number;
  /** Retries after the first attempt, for network errors, 429 and 5xx. */
  maxRetries?: number;
  backoffMs?: number;
  respectRobots?: boolean;
  /**
   * Other user agents whose own robots.txt rules we also obey, e.g. "Claude-User"
   * when Claude Code runs the worker. Only groups naming them apply, not `*`.
   */
  alsoObeyAgents?: string[];
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export class HttpError extends Error {
  override name = "HttpError";
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`HTTP ${status} for ${url}`);
  }
}

export class RobotsDisallowedError extends Error {
  override name = "RobotsDisallowedError";
  constructor(
    readonly url: string,
    /** Set when robots.txt itself could not be read, which RFC 9309 treats as disallow all. */
    readonly unreachableReason?: string,
    /** The agent the blocking rule names, when it is one of `alsoObeyAgents`. */
    readonly agent?: string,
  ) {
    super(
      unreachableReason
        ? `robots.txt could not be read (${unreachableReason}), so not fetching ${url}`
        : agent
          ? `robots.txt disallows ${agent}, so not fetching ${url}`
          : `robots.txt disallows ${url}`,
    );
  }
}

const ROBOTS_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_RETRY_AFTER_MS = 60_000;

interface RobotsPolicy {
  own: RobotsRule[];
  extra: { agent: string; rules: RobotsRule[] }[];
}

interface RobotsEntry {
  /** Shared so concurrent requests to a new host fetch robots.txt once. */
  policy: Promise<RobotsPolicy | { unreachable: string }>;
  fetchedAt: number;
}

export class PoliteHttpClient implements HttpClient {
  private readonly options: Required<PoliteHttpOptions>;
  private readonly hostQueues = new Map<string, Promise<unknown>>();
  private readonly lastRequestAt = new Map<string, number>();
  private readonly robots = new Map<string, RobotsEntry>();
  private requests = 0;

  constructor(options: PoliteHttpOptions) {
    this.options = {
      minIntervalMs: 3000,
      timeoutMs: 15_000,
      maxRetries: 2,
      backoffMs: 2000,
      respectRobots: true,
      alsoObeyAgents: [],
      fetch: globalThis.fetch.bind(globalThis),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      now: () => Date.now(),
      ...options,
    };
  }

  /** Requests sent so far, including robots.txt and retries. */
  get requestCount(): number {
    return this.requests;
  }

  /** `accept` overrides the Accept header, e.g. "application/json" for a JSON endpoint. */
  async getText(
    url: string,
    { accept = "text/html,text/plain" }: { accept?: string } = {},
  ): Promise<string> {
    if (this.options.respectRobots) await this.checkRobots(url);
    return this.withRetries(url, async () => {
      const response = await this.send(url, accept);
      if (!response.ok) throw new HttpError(url, response.status);
      return response.text();
    });
  }

  private async checkRobots(url: string): Promise<void> {
    const { origin, pathname, search } = new URL(url);
    let entry = this.robots.get(origin);
    if (!entry || this.options.now() - entry.fetchedAt > ROBOTS_TTL_MS) {
      entry = { policy: this.loadRobots(origin), fetchedAt: this.options.now() };
      this.robots.set(origin, entry);
    }
    const policy = await entry.policy;
    if ("unreachable" in policy) throw new RobotsDisallowedError(url, policy.unreachable);
    const path = pathname + search;
    if (!isAllowed(policy.own, path)) throw new RobotsDisallowedError(url);
    for (const { agent, rules } of policy.extra) {
      if (!isAllowed(rules, path)) throw new RobotsDisallowedError(url, undefined, agent);
    }
  }

  /** RFC 9309: 4xx means no rules; 5xx or unreachable means assume everything is disallowed. */
  private async loadRobots(origin: string): Promise<RobotsPolicy | { unreachable: string }> {
    try {
      const response = await this.send(`${origin}/robots.txt`);
      if (response.status >= 400 && response.status < 500) return { own: [], extra: [] };
      if (!response.ok) return { unreachable: `HTTP ${response.status}` };
      const groups = parseRobotsGroups(await response.text());
      return {
        own: rulesFor(groups, productToken(this.options.userAgent)),
        extra: this.options.alsoObeyAgents.map((agent) => ({
          agent,
          rules: rulesNaming(groups, agent.toLowerCase()) ?? [],
        })),
      };
    } catch (error) {
      if (error instanceof HttpError) return { unreachable: `HTTP ${error.status}` };
      const cause =
        error instanceof Error && error.cause instanceof Error ? `: ${error.cause.message}` : "";
      return { unreachable: error instanceof Error ? `${error.message}${cause}` : String(error) };
    }
  }

  private async withRetries<T>(url: string, attempt: () => Promise<T>): Promise<T> {
    for (let tries = 0; ; tries++) {
      try {
        return await attempt();
      } catch (error) {
        if (tries >= this.options.maxRetries || !isRetryable(error)) throw error;
        const retryAfter = error instanceof RetryAfterError ? error.ms : 0;
        await this.options.sleep(Math.max(retryAfter, this.options.backoffMs * 2 ** tries));
      }
    }
  }

  /** One request, queued behind earlier requests to the same host. */
  private send(url: string, accept = "text/plain"): Promise<Response> {
    const host = new URL(url).host;
    const previous = this.hostQueues.get(host) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        const last = this.lastRequestAt.get(host);
        if (last !== undefined) {
          const wait = last + this.options.minIntervalMs - this.options.now();
          if (wait > 0) await this.options.sleep(wait);
        }
        this.lastRequestAt.set(host, this.options.now());
        this.requests++;
        const response = await this.options.fetch(url, {
          headers: { "User-Agent": this.options.userAgent, Accept: accept },
          redirect: "follow",
          signal: AbortSignal.timeout(this.options.timeoutMs),
        });
        if (response.status === 429 || response.status >= 500) {
          throw new RetryAfterError(url, response.status, retryAfterMs(response));
        }
        return response;
      });
    this.hostQueues.set(host, next);
    return next;
  }
}

class RetryAfterError extends HttpError {
  constructor(
    url: string,
    status: number,
    readonly ms: number,
  ) {
    super(url, status);
  }
}

function isRetryable(error: unknown): boolean {
  if (error instanceof RetryAfterError) return true;
  if (error instanceof HttpError || error instanceof RobotsDisallowedError) return false;
  return true; // Network failures and timeouts.
}

function retryAfterMs(response: Response): number {
  const seconds = Number(response.headers.get("retry-after"));
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, MAX_RETRY_AFTER_MS) : 0;
}

/** "BookOnBot/0.1 (+https://...)" → "bookonbot". */
function productToken(userAgent: string): string {
  return (userAgent.split(/[/\s]/)[0] ?? "").toLowerCase();
}

export interface RobotsRule {
  allow: boolean;
  path: string;
}

interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
  /** Any Allow or Disallow line seen, even an empty one, which ends the list of agents. */
  hasRules: boolean;
}

/** Rules from the group naming our product token, otherwise the `*` group. */
export function parseRobots(text: string, token: string): RobotsRule[] {
  return rulesFor(parseRobotsGroups(text), token);
}

function rulesFor(groups: RobotsGroup[], token: string): RobotsRule[] {
  return rulesNaming(groups, token) ?? groups.find((g) => g.agents.includes("*"))?.rules ?? [];
}

/** Rules from a group that names this agent specifically, or null. */
export function rulesNaming(groups: RobotsGroup[], token: string): RobotsRule[] | null {
  return groups.find((g) => g.agents.some((a) => a !== "*" && token.startsWith(a)))?.rules ?? null;
}

export function parseRobotsGroups(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      if (!current || current.hasRules) {
        current = { agents: [], rules: [], hasRules: false };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if ((field === "allow" || field === "disallow") && current) {
      current.hasRules = true;
      if (value === "" && field === "disallow") continue; // "Disallow:" with no path allows everything.
      current.rules.push({ allow: field === "allow", path: value });
    }
  }
  return groups;
}

/** Longest matching rule wins; Allow wins a tie. Supports `*` and `$` wildcards. */
export function isAllowed(rules: RobotsRule[], path: string): boolean {
  let best: RobotsRule | null = null;
  for (const rule of rules) {
    if (!robotsPatternMatches(rule.path, path)) continue;
    if (
      !best ||
      rule.path.length > best.path.length ||
      (rule.path.length === best.path.length && rule.allow)
    ) {
      best = rule;
    }
  }
  return best?.allow ?? true;
}

function robotsPatternMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`).test(path);
}
