import { describe, expect, it } from "vitest";
import type { ClubApplication, ClubRate } from "@bookon/db";
import {
  clubApplicationNotice,
  clubApplicationText,
  clubLinkEmail,
  describeRate,
} from "./club-emails";

const base = {
  holes: null,
  days: "any",
  daysOfWeek: null,
  timeFrom: null,
  timeTo: null,
  player: "any",
  priceCents: 4200,
  unit: "per_player",
  validFrom: null,
  validTo: null,
  courseName: null,
} as const;

describe("describeRate", () => {
  it("says when a price applies, in plain words", () => {
    expect(describeRate({ ...base, holes: 18, days: "weekday", player: "adult" })).toBe(
      "18 holes · Midweek (Mon–Fri) · Adult · $42 per player",
    );
    expect(describeRate({ ...base, holes: 18, timeFrom: "15:00:00" })).toBe(
      "18 holes · Any day · from 3:00 pm · $42 per player",
    );
    expect(
      describeRate({
        ...base,
        days: "custom",
        daysOfWeek: [2, 4],
        priceCents: 6000,
        unit: "per_group",
        validFrom: "2026-11-01",
        validTo: "2027-02-28",
      }),
    ).toBe("Tue, Thu · 1 Nov 2026 to 28 Feb 2027 · $60 per group");
    expect(describeRate({ ...base, unit: "per_cart", priceCents: 4500, courseName: "Pines" })).toBe(
      "Pines · Any day · $45 per cart",
    );
  });
});

const application = {
  id: "11111111-2222-3333-4444-555555555555",
  clubName: "Lakeside Golf",
  contactName: "Jo Smith",
  contactEmail: "jo@lakeside.example",
  status: "submitted",
  paymentsInterest: "maybe",
  details: {
    club: {
      name: "Lakeside Golf",
      suburb: "Como",
      state: "WA",
      abn: "12345678901",
      kind: "public",
    },
    contacts: { main: { name: "Jo Smith", role: "Manager", email: "jo@lakeside.example" } },
    courses: [{ name: "Lakeside", holes: 18, par: 70 }],
    teeTimes: { bookingSystem: "miclub", intervalMinutes: 8, windowDays: 14 },
    extras: { facilities: ["carts", "bar"] },
  },
  consents: {
    authorised: { accepted: true, by: "Jo Smith", at: "2026-10-18T01:00:00.000Z" },
  },
} as unknown as ClubApplication;

const rates = [
  {
    ...base,
    name: "18 holes midweek",
    holes: 18,
    days: "weekday",
    player: "adult",
    gstIncluded: true,
    notes: null,
  },
] as unknown as ClubRate[];

describe("club listing emails", () => {
  it("summarise everything the club sent, for review", () => {
    const text = clubApplicationText(application, rates, 2);
    expect(text).toContain("CLUB: Lakeside Golf");
    expect(text).toContain("ABN: 12345678901");
    expect(text).toContain("Main: Jo Smith, Manager, jo@lakeside.example");
    expect(text).toContain("Lakeside: 18 holes, par 70");
    expect(text).toContain("Booking system: MiClub");
    expect(text).toContain(
      "18 holes midweek: 18 holes · Midweek (Mon–Fri) · Adult · $42 per player",
    );
    expect(text).toContain("Motorised carts, Bar");
    expect(text).toContain("Photos: 2");
    expect(text).toMatch(/\[yes\] I'm authorised .* \(Jo Smith, 2026-10-18T01:00:00.000Z\)/);
    expect(text).toContain("Interested in taking payments through BookOn: maybe");
    expect(
      clubApplicationNotice({ to: "info@bookon.com.au", application, rates, photoCount: 2 }).text,
    ).toContain("pnpm clubs show 11111111-2222-3333-4444-555555555555");
  });

  it("send the private link, warning it lets anyone edit", () => {
    const email = clubLinkEmail({
      to: "jo@lakeside.example",
      name: "Jo <Smith>",
      clubName: "Lakeside",
      link: "https://bookon.test/clubs/join/abc",
    });
    expect(email.text).toContain("https://bookon.test/clubs/join/abc");
    expect(email.text).toContain("share it only with your team");
    expect(email.html).toContain("Jo &#60;Smith&#62;");
  });
});
