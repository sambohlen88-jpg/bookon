import type { CheckProblem } from "@bookon/db";

/** Why we couldn't check, for the line under a course. */
export const PROBLEM_SENTENCE: Record<CheckProblem, string> = {
  blocked:
    "the club's site now has a security check or asks us not to read it, so we can't show its times",
  "site-down": "the club's booking site isn't responding",
  unreadable: "we couldn't read the club's booking page (it may have changed, and we're on it)",
  old: "we haven't checked it recently",
};

/** Short labels for the list of courses with nothing to show. */
export const PROBLEM_LABEL: Record<CheckProblem, string> = {
  blocked: "Club's site blocks our checks",
  "site-down": "Club's site not responding",
  unreadable: "Can't read the club's page",
  old: "Not checked recently",
};
