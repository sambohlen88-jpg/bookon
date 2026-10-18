import type { Metadata } from "next";
import { AREAS, areaName, formatPerthTime, perthDate } from "@bookon/core";
import { approvedCoursePhotos, listCourseDetails, nextTeeTimes } from "@bookon/db";
import { CourseDirectory } from "@/components/course-directory";
import { SiteHeader } from "@/components/site-header";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Courses · BookOn",
  description: "The Perth and WA public golf courses BookOn checks for tee times.",
};

export default async function CoursesPage() {
  const now = new Date();
  const db = getDb();
  const courses = await listCourseDetails(db);
  const photos = await approvedCoursePhotos(db);
  const upcoming = await nextTeeTimes(db, now, { players: 1 });
  const today = perthDate(now);
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
          The {courses.length} public courses BookOn checks for tee times. Pick one to see
          what&apos;s free over the next week.
        </p>
        <CourseDirectory
          areas={areas}
          courses={courses.map((c) => {
            const next = upcoming.find((u) => u.course.id === c.id)?.teeTimes[0];
            return {
              slug: c.slug,
              name: c.name,
              suburb: c.suburb,
              holes: c.holes,
              area: c.area,
              areaName: areaName(c.area),
              latitude: c.latitude,
              longitude: c.longitude,
              photoId: photos.get(c.id) ?? null,
              next: next
                ? `Next free ${next.playDate === today ? "" : "tomorrow "}${formatPerthTime(next.startTime)}`
                : null,
            };
          })}
        />
        <p className="mt-10 text-sm text-muted">
          Pictures are drawings unless the club has given us a photo.
        </p>
      </main>
    </>
  );
}
