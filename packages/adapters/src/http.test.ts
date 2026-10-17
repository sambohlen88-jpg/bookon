import { describe, expect, it } from "vitest";
import { HttpError, PoliteHttpClient, RobotsDisallowedError, isAllowed, parseRobots } from "./http";

const UA = "BookOnBot/0.1 (+https://bookon.com.au; hello@bookon.com.au)";

/** A fake clock and fetch so tests run instantly and can see timing. */
function harness(handler: (url: string) => Response | Promise<Response>) {
  let clock = 0;
  const calls: { url: string; at: number; userAgent: string | null }[] = [];
  const client = new PoliteHttpClient({
    userAgent: UA,
    minIntervalMs: 3000,
    backoffMs: 1000,
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
    fetch: (async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, at: clock, userAgent: new Headers(init?.headers).get("user-agent") });
      return handler(url);
    }) as typeof fetch,
  });
  return { client, calls };
}

const ok = (body = "ok") => new Response(body, { status: 200 });

describe("PoliteHttpClient", () => {
  it("identifies itself and spaces out requests to the same host", async () => {
    const { client, calls } = harness((url) =>
      url.endsWith("robots.txt") ? new Response("", { status: 404 }) : ok(),
    );
    await Promise.all([
      client.getText("https://a.example/1"),
      client.getText("https://a.example/2"),
    ]);

    expect(calls.map((c) => c.url)).toEqual([
      "https://a.example/robots.txt",
      "https://a.example/1",
      "https://a.example/2",
    ]);
    expect(calls.every((c) => c.userAgent === UA)).toBe(true);
    const gaps = calls.slice(1).map((c, i) => c.at - calls[i]!.at);
    expect(gaps.every((gap) => gap >= 3000)).toBe(true);
    expect(client.requestCount).toBe(3);
  });

  it("reads robots.txt once per host", async () => {
    const { client, calls } = harness((url) =>
      url.endsWith("robots.txt") ? ok("User-agent: *\nAllow: /") : ok(),
    );
    await client.getText("https://a.example/1");
    await client.getText("https://a.example/2");
    expect(calls.filter((c) => c.url.endsWith("robots.txt"))).toHaveLength(1);
  });

  it("refuses paths robots.txt disallows, without fetching them", async () => {
    const { client, calls } = harness((url) =>
      url.endsWith("robots.txt") ? ok("User-agent: *\nDisallow: /guests/") : ok(),
    );
    await expect(client.getText("https://a.example/guests/bookings/x")).rejects.toThrow(
      RobotsDisallowedError,
    );
    expect(calls.map((c) => c.url)).toEqual(["https://a.example/robots.txt"]);
  });

  it("treats an unreachable robots.txt as disallow all", async () => {
    const { client } = harness((url) =>
      url.endsWith("robots.txt") ? new Response("", { status: 503 }) : ok(),
    );
    await expect(client.getText("https://a.example/page")).rejects.toThrow(
      /could not be read \(HTTP 503\)/,
    );
  });

  it("retries server errors with back-off, then gives up", async () => {
    const { client, calls } = harness((url) =>
      url.endsWith("robots.txt")
        ? new Response("", { status: 404 })
        : new Response("", { status: 502 }),
    );
    await expect(client.getText("https://a.example/page")).rejects.toThrow(HttpError);
    const pageCalls = calls.filter((c) => c.url.endsWith("/page"));
    expect(pageCalls).toHaveLength(3);
    expect(pageCalls[2]!.at - pageCalls[1]!.at).toBeGreaterThanOrEqual(2000);
  });

  it("honours Retry-After on 429", async () => {
    let attempts = 0;
    const { client, calls } = harness((url) => {
      if (url.endsWith("robots.txt")) return new Response("", { status: 404 });
      attempts++;
      return attempts === 1
        ? new Response("", { status: 429, headers: { "Retry-After": "20" } })
        : ok("done");
    });
    await expect(client.getText("https://a.example/page")).resolves.toBe("done");
    const pageCalls = calls.filter((c) => c.url.endsWith("/page"));
    expect(pageCalls[1]!.at - pageCalls[0]!.at).toBeGreaterThanOrEqual(20_000);
  });

  it("does not retry other client errors", async () => {
    const { client, calls } = harness((url) =>
      url.endsWith("robots.txt")
        ? new Response("", { status: 404 })
        : new Response("", { status: 403 }),
    );
    await expect(client.getText("https://a.example/page")).rejects.toThrow("HTTP 403");
    expect(calls.filter((c) => c.url.endsWith("/page"))).toHaveLength(1);
  });
});

describe("robots.txt rules", () => {
  const text = [
    "User-agent: *",
    "Disallow: /guests/",
    "Allow: /guests/bookings/ViewPublic",
    "",
    "User-agent: BookOnBot",
    "Disallow: /private",
  ].join("\n");

  it("uses our own group when one exists", () => {
    const rules = parseRobots(text, "bookonbot");
    expect(isAllowed(rules, "/guests/bookings/ViewPublicCalendar.msp")).toBe(true);
    expect(isAllowed(rules, "/private/x")).toBe(false);
  });

  it("falls back to the * group with longest match winning", () => {
    const rules = parseRobots(text, "otherbot");
    expect(isAllowed(rules, "/guests/bookings/ViewPublicCalendar.msp")).toBe(true);
    expect(isAllowed(rules, "/guests/members")).toBe(false);
    expect(isAllowed(rules, "/cms/")).toBe(true);
  });

  it("supports wildcards and an empty Disallow", () => {
    expect(isAllowed(parseRobots("User-agent: *\nDisallow: /*.msp$", "x"), "/a/b.msp")).toBe(false);
    expect(isAllowed(parseRobots("User-agent: *\nDisallow: /*.msp$", "x"), "/a/b.msp?x=1")).toBe(
      true,
    );
    expect(isAllowed(parseRobots("User-agent: *\nDisallow:", "x"), "/anything")).toBe(true);
  });
});
