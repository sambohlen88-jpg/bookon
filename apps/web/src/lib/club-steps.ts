/** The club onboarding steps, in order. */
export const CLUB_STEPS = [
  { slug: "club", title: "Your club" },
  { slug: "contacts", title: "Contacts" },
  { slug: "courses", title: "Courses" },
  { slug: "tee-times", title: "Tee times" },
  { slug: "prices", title: "Prices" },
  { slug: "extras", title: "Photos and facilities" },
  { slug: "approvals", title: "Approvals" },
  { slug: "review", title: "Review and send" },
] as const;

export type ClubStep = (typeof CLUB_STEPS)[number]["slug"];

export function isClubStep(value: string): value is ClubStep {
  return CLUB_STEPS.some((s) => s.slug === value);
}

export function nextClubStep(step: ClubStep): ClubStep {
  const i = CLUB_STEPS.findIndex((s) => s.slug === step);
  return CLUB_STEPS[Math.min(i + 1, CLUB_STEPS.length - 1)]!.slug;
}

export function previousClubStep(step: ClubStep): ClubStep | null {
  const i = CLUB_STEPS.findIndex((s) => s.slug === step);
  return i > 0 ? CLUB_STEPS[i - 1]!.slug : null;
}

export function clubStepHref(token: string, step: ClubStep): string {
  return `/clubs/join/${token}/${step}`;
}
