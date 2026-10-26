import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MailchimpAudience, createMarketingList, readMailchimpWebhook } from "./mailchimp";

// Shaped like Mailchimp's documented responses (no calls to the live API).
const member = { id: "5f6f2f3c", email_address: "sam@example.com", status: "subscribed" };
const compliance = {
  type: "https://mailchimp.com/developer/marketing/docs/errors/",
  title: "Member In Compliance State",
  status: 400,
  detail: "sam@example.com is already a list member in compliance state due to unsubscribe.",
};

function recorder(responses: Response[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return responses.shift()!;
  }) as typeof fetch;
  return { calls, fetchImpl };
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const consented = new Date("2026-10-27T02:00:00Z");

describe("MailchimpAudience (Milestone 27)", () => {
  it("adds or updates a member by the hash of their email", async () => {
    const { calls, fetchImpl } = recorder([json(member)]);
    const audience = new MailchimpAudience("key123-us21", "aud1", fetchImpl);
    expect(await audience.setStatus("Sam@Example.com", "subscribed", consented)).toBe("done");
    const hash = createHash("md5").update("sam@example.com").digest("hex");
    expect(calls[0]!.url).toBe(`https://us21.api.mailchimp.com/3.0/lists/aud1/members/${hash}`);
    expect(calls[0]!.init.method).toBe("PUT");
    expect(new Headers(calls[0]!.init.headers).get("authorization")).toBe(
      `Basic ${Buffer.from("bookon:key123-us21").toString("base64")}`,
    );
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      email_address: "sam@example.com",
      status_if_new: "subscribed",
      status: "subscribed",
      timestamp_opt: "2026-10-27T02:00:00.000Z",
    });
  });

  it("asks someone who unsubscribed in Mailchimp to confirm, rather than forcing them back", async () => {
    const { calls, fetchImpl } = recorder([json(compliance, 400), json(member)]);
    const audience = new MailchimpAudience("key123-us21", "aud1", fetchImpl);
    expect(await audience.setStatus("sam@example.com", "subscribed", consented)).toBe("pending");
    expect(JSON.parse(String(calls[1]!.init.body))).toMatchObject({ status: "pending" });
  });

  it("unsubscribes, and reports other refusals", async () => {
    const { calls, fetchImpl } = recorder([json(member), json({ title: "Invalid Resource" }, 400)]);
    const audience = new MailchimpAudience("key123-us21", "aud1", fetchImpl);
    await audience.setStatus("sam@example.com", "unsubscribed", consented);
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      email_address: "sam@example.com",
      status_if_new: "unsubscribed",
      status: "unsubscribed",
    });
    await expect(audience.setStatus("sam@example.com", "subscribed", consented)).rejects.toThrow(
      "HTTP 400",
    );
  });

  it("is off until both settings are there", () => {
    expect(createMarketingList({})).toBeNull();
    expect(createMarketingList({ MAILCHIMP_API_KEY: "k-us21" })).toBeNull();
    expect(
      createMarketingList({ MAILCHIMP_API_KEY: "k-us21", MAILCHIMP_AUDIENCE_ID: "a" }),
    ).not.toBeNull();
    expect(() => new MailchimpAudience("nodatacentre", "a")).toThrow("data centre");
  });
});

describe("readMailchimpWebhook (Milestone 27)", () => {
  const post = (fields: Record<string, string>) => new URLSearchParams(fields);
  it("reads unsubscribes, bounces, sign-ups and changed addresses", () => {
    expect(
      readMailchimpWebhook(
        post({
          type: "unsubscribe",
          fired_at: "2026-10-27 02:00:00",
          "data[action]": "unsub",
          "data[reason]": "manual",
          "data[email]": "Sam@Example.com",
          "data[list_id]": "aud1",
        }),
      ),
    ).toEqual({ kind: "unsubscribed", email: "sam@example.com", listId: "aud1" });
    expect(
      readMailchimpWebhook(
        post({ type: "cleaned", "data[email]": "x@example.com", "data[list_id]": "aud1" }),
      ),
    ).toMatchObject({ kind: "unsubscribed" });
    expect(
      readMailchimpWebhook(
        post({ type: "subscribe", "data[email]": "y@example.com", "data[list_id]": "aud1" }),
      ),
    ).toMatchObject({ kind: "subscribed", email: "y@example.com" });
    expect(
      readMailchimpWebhook(
        post({
          type: "upemail",
          "data[old_email]": "old@example.com",
          "data[new_email]": "new@example.com",
          "data[list_id]": "aud1",
        }),
      ),
    ).toEqual({
      kind: "changed-email",
      oldEmail: "old@example.com",
      newEmail: "new@example.com",
      listId: "aud1",
    });
    expect(
      readMailchimpWebhook(post({ type: "profile", "data[email]": "z@example.com" })),
    ).toBeNull();
  });
});
