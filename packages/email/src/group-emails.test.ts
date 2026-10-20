import { describe, expect, it } from "vitest";
import { perthToUtc } from "@bookon/core";
import { groupBookedEmail, groupCalendarEvent, groupSessionCancelledEmail } from "./group-emails";

const session = {
  id: "11111111-2222-3333-4444-555555555555",
  title: "Beginners' clinic",
  startTime: perthToUtc("2026-11-07", "15:00"),
  endTime: perthToUtc("2026-11-07", "16:00"),
  place: "Range, Como",
  priceCents: 4000,
  minSpots: 3,
  goingAheadAt: null,
};
const booking = {
  golferName: "Alex Golfer",
  golferEmail: "alex@example.com",
  golferPhone: "+61491570110",
  note: "Me and my daughter (12)",
  spots: 2,
  spotsCents: 8000,
  feeCents: 250,
};

describe("group session emails", () => {
  it("confirms the spots, the total and the minimum", () => {
    const email = groupBookedEmail({
      session,
      booking,
      coachName: "Mia Hartley",
      coachContact: { phone: "+61491570157" },
      manageLink: "https://bookon.test/sessions/abc",
    });
    expect(email.subject).toBe("Booked: Beginners' clinic with Mia Hartley, Sat 7 Nov, 3:00 pm");
    expect(email.text).toContain("2 spots at $40: $80");
    expect(email.text).toContain("Total: $82.50");
    expect(email.text).toContain("needs at least 3 people");
    expect(email.text).toContain("https://bookon.test/sessions/abc/calendar.ics");
  });

  it("says why a session was called off", () => {
    const email = groupSessionCancelledEmail({
      session,
      booking,
      coachName: "Mia Hartley",
      reason: "minimum",
      note: null,
      refundCents: 8250,
      coachPage: "https://bookon.test/coaches/mia-hartley",
    });
    expect(email.text).toContain("didn't get the 3 people it needed");
    expect(email.text).toContain("refunded the full $82.50");
  });

  it("lists who's coming in the coach's calendar", () => {
    const event = groupCalendarEvent(session, { for: "coach", bookings: [booking] });
    expect(event.summary).toBe("Group: Beginners' clinic (2 booked)");
    expect(event.description).toContain(
      "Alex Golfer (2 spots), 0491 570 110: Me and my daughter (12)",
    );
    expect(event.uid).toBe("group-11111111-2222-3333-4444-555555555555@bookon");
  });
});
