import type { Metadata } from "next";
import {
  AREAS,
  addPerthDays,
  areaName,
  cheapestCents,
  formatPerthDay,
  formatPerthTime,
  perthDate,
} from "@bookon/core";
import { approvedCoursePhotos, listCourseDetails, nextTeeTimes, ratingSummaries } from "@bookon/db";
import { CourseDirectory } from "@/components/course-directory";
import { SiteHeader } from "@/components/site-header";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Courses · BookOn",
  description:
    "The Perth and WA public golf courses BookOn checks for tee times, and the golf sims and driving ranges it checks for free bays.",
};

export default async function CoursesPage() {
  const now = new Date();
  const db = getDb();
  const courses = await listCourseDetails(db);
  const photos = await approvedCoursePhotos(db);
  // The week ahead: for the next free time, and sorting by price and free times (Milestone 20).
  const upcoming = await nextTeeTimes(db, now, { players: 1, play: "all", days: 7 });
  const ratings = await ratingSummaries(db);
  const golf = courses.filter((c) => c.kind === "course").length;
  const venues = courses.length - golf;
  const today = perthDate(now);
  const tomorrow = addPerthDays(today, 1);
  const dayWord = (date: string) =>
    date === today
      ? ""
      : date === tomorrow
        ? "tomorrow "
        : `${formatPerthDay(date).split(" ")[0]} `;
  const areas = AREAS.filter((a) => courses.some((c) => c.area === a.id)).map((a) => ({
    id: a.id,
    name: a.name,
  }));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 pb-12 pt-6 md:max-w-6xl md:px-6 md:pt-12">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Courses</h1>
        <p className="mt-2 max-w-2xl text-muted md:text-lg">
          The {golf} public courses BookOn checks for tee times
          {venues > 0 ? `, and ${venues} golf sims and driving ranges` : ""}. Pick one to see
          what&apos;s free over the next two weeks, or sort by price, free times or rating.
        </p>
        <CourseDirectory
          areas={areas}
          courses={courses.map((c) => {
            const times = upcoming.find((u) => u.course.id === c.id)?.teeTimes ?? [];
            const next = times[0];
            return {
              slug: c.slug,
              name: c.name,
              suburb: c.suburb,
              detail:
                c.kind === "simulator"
                  ? "Golf sim"
                  : c.kind === "range"
                    ? "Driving range"
                    : `${c.holes} holes`,
              venue: c.kind !== "course",
              area: c.area,
              areaName: areaName(c.area),
              latitude: c.latitude,
              longitude: c.longitude,
              photoId: photos.get(c.id) ?? null,
              next: next
                ? `Next free ${dayWord(next.playDate)}${formatPerthTime(next.startTime)}`
                : null,
              firstStart: next ? next.startTime.getTime() : null,
              cheapestCents: cheapestCents(times),
              freeTimes: times.length,
              rating: ratings.get(c.id) ?? null,
            };
          })}
        />
        <p className="mt-10 text-sm text-muted">
          Pictures are drawings unless the club or venue has given us a photo.
        </p>
      </main>
    </>
  );
}
