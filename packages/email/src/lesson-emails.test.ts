import { describe, expect, it } from "vitest";
import { perthToUtc } from "@bookon/core";
import {
  lessonCancelledEmail,
  lessonCalendarEvent,
  lessonConfirmedEmail,
  lessonRequestCoachEmail,
  lessonRequestedEmail,
} from "./lesson-emails";

const lesson = {
  id: "3f0c1a2b-0000-4000-8000-000000000000",
  endTime: perthToUtc("2026-10-24", "10:00"),
  rate: { name: "Private lesson", minutes: 60, priceCents: 9000, people: "1" as const },
  startTime: perthToUtc("2026-10-24", "09:00"),
  place: "Range, Como",
  golferName: "Alex <Golfer>",
  golferEmail: "alex@example.com",
  golferPhone: "+61491570110",
  note: "First lesson in years",
  lessonCents: 9000,
  feeCents: 250,
};

describe("lessonCalendarEvent", () => {
  it("shows the coach the golfer's details, and marks waiting requests as not confirmed", () => {
    const waiting = lessonCalendarEvent(
      { ...lesson, status: "requested" },
      { for: "coach", coachName: "Jo Coach" },
    );
    expect(waiting).toMatchObject({
      uid: "lesson-3f0c1a2b-0000-4000-8000-000000000000@bookon",
      summary: "Request (not confirmed): Alex <Golfer>, Private lesson",
      status: "TENTATIVE",
      location: "Range, Como",
    });
    expect(waiting.description).toContain("Mobile: 0491 570 110");
    const golfer = lessonCalendarEvent(
      { ...lesson, status: "confirmed" },
      { for: "golfer", coachName: "Jo Coach" },
    );
    expect(golfer).toMatchObject({ summary: "Golf lesson with Jo Coach", status: "CONFIRMED" });
    expect(golfer.description).not.toContain("0491");
  });
});

describe("lesson emails", () => {
  it("tell the golfer their card is held, not charged, and when the coach will answer", () => {
    const email = lessonRequestedEmail({
      lesson,
      coachName: "Jo Coach",
      respondBy: perthToUtc("2026-10-20", "10:00"),
      manageLink: "https://bookon.test/lessons/abc",
    });
    expect(email.to).toBe("alex@example.com");
    expect(email.subject).toBe("Lesson request sent to Jo Coach");
    expect(email.text).toContain("$92.50 is held on your card but not charged");
    expect(email.text).toContain("by Tue 20 Oct, 10:00 am");
    expect(email.text).toContain("https://bookon.test/lessons/abc");
    // Names are escaped in the HTML.
    expect(email.html).toContain("Alex &#60;Golfer&#62;");
    expect(email.html).not.toContain("<Golfer>");
  });

  it("give the coach the golfer's details and what they'll be paid", () => {
    const email = lessonRequestCoachEmail({
      to: "jo@coach.test",
      lesson,
      coachName: "Jo Coach",
      respondBy: perthToUtc("2026-10-20", "10:00"),
      portalLink: "https://bookon.test/coach#lessons",
    });
    expect(email.subject).toBe("Lesson request: Alex <Golfer>, Sat 24 Oct, 9:00 am");
    expect(email.text).toContain("Mobile: 0491 570 110");
    expect(email.text).toContain("You'll be paid: $90");
    expect(email.text).toContain("Their note: First lesson in years");
  });

  it("confirm with the amounts and the cancellation rule", () => {
    const email = lessonConfirmedEmail({
      lesson,
      coachName: "Jo Coach",
      coachContact: { phone: "+61491570159" },
      manageLink: "https://bookon.test/lessons/abc",
    });
    expect(email.text).toContain("Total: $92.50");
    expect(email.text).toContain("Coach's phone: 0491 570 159");
    expect(email.text).toContain("full refund up to 24 hours before");
    expect(email.text).toContain(
      "Add to Apple or Outlook calendar: https://bookon.test/lessons/abc/calendar.ics",
    );
    expect(email.text).toMatch(
      /Add to Google Calendar: https:\/\/calendar\.google\.com\/.*dates=20261024T010000Z%2F20261024T020000Z/,
    );
  });

  it("say whether a cancellation was refunded", () => {
    const refunded = lessonCancelledEmail({
      lesson,
      coachName: "Jo",
      refundCents: 9250,
      wasCharged: true,
    });
    expect(refunded.text).toContain("We've refunded $92.50");
    const late = lessonCancelledEmail({
      lesson,
      coachName: "Jo",
      refundCents: 0,
      wasCharged: true,
    });
    expect(late.text).toContain("it isn't refunded");
    const held = lessonCancelledEmail({
      lesson,
      coachName: "Jo",
      refundCents: 0,
      wasCharged: false,
    });
    expect(held.text).toContain("you haven't been charged");
  });
});
