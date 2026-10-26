/** What the alert form needs from the server (Milestone 28). */
import { addPerthDays, perthDate } from "@bookon/core";
import { listSearchableCourses, type Database } from "@bookon/db";
import type { AlertFormCourse, AlertFormOptions } from "@/components/alert-form";
import { DAY_OPTIONS, MAX_DAYS_AHEAD, TIME_OPTIONS, formatFormTime } from "@/lib/search-form";

export async function alertFormData(
  db: Database,
  now: Date,
): Promise<{ courses: AlertFormCourse[]; options: AlertFormOptions }> {
  const today = perthDate(now);
  const courses = (await listSearchableCourses(db))
    .filter((c) => c.kind === "course")
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      suburb: c.suburb,
      latitude: c.latitude,
      longitude: c.longitude,
    }));
  return {
    courses,
    options: {
      times: TIME_OPTIONS.filter((t) => t <= "20:00").map((t) => ({
        value: t,
        label: formatFormTime(t),
      })),
      days: DAY_OPTIONS.map((d) => ({ value: d.value, label: d.label })),
      minDate: today,
      maxDate: addPerthDays(today, MAX_DAYS_AHEAD - 1),
    },
  };
}
