import type { Course, CourseAdapter } from "@bookon/core";
import { miclubAdapter } from "./miclub";
import { quick18Adapter } from "./quick18";

export { miclubAdapter } from "./miclub";
export { quick18Adapter } from "./quick18";
export { CaptchaRequiredError, ConfigError, PageFormatError } from "./shared";
export { PoliteHttpClient, HttpError, RobotsDisallowedError } from "./http";
export type { PoliteHttpOptions } from "./http";

const adapters: Partial<Record<Course["platform"], CourseAdapter>> = {
  miclub: miclubAdapter,
  quick18: quick18Adapter,
};

/** The adapter for a course's platform, or undefined when it cannot be searched (chronogolf, manual). */
export function adapterFor(course: Pick<Course, "platform">): CourseAdapter | undefined {
  return adapters[course.platform];
}
