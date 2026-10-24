import { describe, expect, it } from "vitest";
import type { AlertMatch, SearchParams } from "@bookon/db";
import { PostmarkMailer, createMailer, OutboxMailer, tagEmailLinks } from "./mailer";
import { alertEmail, describeSearch, searchUrlFor, signInEmail } from "./templates";

const filters: SearchParams = {
  dateFrom: "2026-10-18",
  dateTo: "2026-10-18",
  timeFrom: "06:00",
  timeTo: "12:00",
  players: 2,
  holes: 18,
  courseSlugs: ["collier-park"],
};

function match(iso: string, price: number | null = 4000): AlertMatch & { href: string } {
  return {
    course: { id: "c1", slug: "collier-park", name: "Collier Park Golf Course", suburb: "Como" },
    teeTime: {
      startTime: new Date(iso),
      playDate: "2026-10-18",
      holes: 18,
      layout: null,
      spotsAvailable: 4,
      priceCents: price,
      bookingUrl: "https://bookings.collierparkgolf.com.au/x",
    },
    href: `https://bookon.com.au/go/token-${iso}`,
  };
}

describe("describeSearch", () => {
  it("reads like the results page", () => {
    expect(describeSearch(filters)).toMatch(
      /^Sun 18 Oct · 6:00\s?am to 12:00\s?pm · 2 players · 18 holes$/,
    );
  });
});

describe("signInEmail", () => {
  it("contains the link and says it expires", () => {
    const email = signInEmail("sam@example.com", "https://bookon.com.au/auth/callback?token=abc");
    expect(email.text).toContain("https://bookon.com.au/auth/callback?token=abc");
    expect(email.html).toContain("token=abc");
    expect(email.text).toContain("15 minutes");
  });
});

describe("alertEmail", () => {
  const input = {
    to: "sam@example.com",
    filters,
    matches: [match("2026-10-17T23:40:00Z"), match("2026-10-18T00:20:00Z", null)],
    searchUrl: "https://bookon.com.au/search?date=2026-10-18",
    manageUrl: "https://bookon.com.au/alerts/manage-token",
  };

  it("lists each new time with its tracked Book link", () => {
    const email = alertEmail(input);
    expect(email.subject).toBe("2 new tee times at Collier Park Golf Course");
    expect(email.text).toContain("https://bookon.com.au/go/token-2026-10-17T23:40:00Z");
    expect(email.text).toMatch(
      /Sun 18 Oct 7:40\s?am · Collier Park Golf Course · 18 holes · 4 spots · \$40/,
    );
    expect(email.text).toContain("price at club");
  });

  it("names the sender and offers a way to stop, as the Spam Act requires", () => {
    const email = alertEmail(input);
    for (const body of [email.text, email.html]) {
      expect(body).toContain("manage-token");
      expect(body).toContain("info@bookon.com.au");
    }
  });

  it("caps the list and points to the rest", () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      match(new Date(Date.UTC(2026, 9, 17, 22, i)).toISOString()),
    );
    const email = alertEmail({ ...input, matches: many });
    expect(email.text.match(/Book: /g)).toHaveLength(20);
    expect(email.text).toContain("And 5 more");
  });

  it("escapes anything that ends up in HTML", () => {
    const evil = {
      ...match("2026-10-17T23:40:00Z"),
      course: { id: "c", slug: "x", name: "<script>x</script>", suburb: "" },
    };
    expect(alertEmail({ ...input, matches: [evil] }).html).not.toContain("<script>");
  });
});

describe("searchUrlFor", () => {
  it("rebuilds the search", () => {
    expect(searchUrlFor("https://bookon.com.au", { ...filters, dateTo: "2026-10-20" })).toBe(
      "https://bookon.com.au/search?date=2026-10-18&days=3&from=06%3A00&to=12%3A00&players=2&holes=18&course=collier-park",
    );
  });
});

describe("PostmarkMailer", () => {
  it("posts the email to Postmark's API", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    await new PostmarkMailer("server-token", "BookOn <info@bookon.com.au>", fakeFetch).send({
      to: "sam@example.com",
      subject: "Hi",
      text: "Hello",
      html: "<p>Hello</p>",
    });
    expect(calls[0]!.url).toBe("https://api.postmarkapp.com/email");
    expect(new Headers(calls[0]!.init.headers).get("x-postmark-server-token")).toBe("server-token");
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({
      To: "sam@example.com",
      MessageStream: "outbound",
    });
  });

  it("reports a refusal", async () => {
    const refuse = (async () =>
      new Response("bad sender", { status: 422 })) as unknown as typeof fetch;
    await expect(
      new PostmarkMailer("t", undefined, refuse).send({
        to: "a@b.co",
        subject: "s",
        text: "t",
        html: "h",
      }),
    ).rejects.toThrow("HTTP 422");
  });
});

describe("createMailer", () => {
  it("uses the outbox unless Postmark is configured", () => {
    const db = {} as never;
    expect(createMailer(db, {})).toBeInstanceOf(OutboxMailer);
    expect(
      createMailer(db, { EMAIL_PROVIDER: "postmark", POSTMARK_SERVER_TOKEN: "t" }),
    ).toBeInstanceOf(PostmarkMailer);
    expect(() => createMailer(db, { EMAIL_PROVIDER: "postmark" })).toThrow("POSTMARK_SERVER_TOKEN");
  });
});

describe("tagging links in emails", () => {
  const site = "https://bookon.com.au";
  const message = (body: string) => ({
    to: "a@example.com",
    subject: "Hi",
    text: body,
    html: `<a href="${body}">x</a>`,
  });

  it("tags links to BookOn's pages with the kind of email", () => {
    const tagged = tagEmailLinks(message("https://bookon.com.au/lessons/abc?paid=1#when"), site);
    expect(tagged.text).toBe(
      "https://bookon.com.au/lessons/abc?paid=1&utm_source=bookon&utm_medium=email&utm_campaign=lesson#when",
    );
    expect(tagged.html).toContain("utm_campaign=lesson");
    expect(tagEmailLinks(message("https://bookon.com.au/alerts/xyz"), site).text).toBe(
      "https://bookon.com.au/alerts/xyz?utm_source=bookon&utm_medium=email&utm_campaign=alert",
    );
  });

  it("leaves sign-in links, club click-throughs, calendar files and other sites alone", () => {
    for (const url of [
      "https://bookon.com.au/auth/callback?token=abc",
      "https://bookon.com.au/go/tok",
      "https://bookon.com.au/lessons/abc/calendar.ics",
      "https://www.met.no/en",
    ])
      expect(tagEmailLinks(message(url), site).text).toBe(url);
  });
});
