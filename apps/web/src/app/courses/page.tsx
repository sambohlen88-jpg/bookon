import type { Metadata } from "next";
import { listCourseDetails } from "@bookon/db";
import { CourseCard } from "@/components/course-card";
import { SiteHeader } from "@/components/site-header";
import { getDb } from "@/lib/db";
import { AREAS, courseArea } from "@/lib/course-info";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Courses · BookOn",
  description: "The Perth and WA public golf courses BookOn checks for tee times.",
};

export default async function CoursesPage() {
  const courses = await listCourseDetails(getDb());
  const byArea = AREAS.map((area) => ({
    area,
    courses: courses.filter((c) => courseArea(c.slug) === area),
  })).filter((g) => g.courses.length > 0);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 pb-12 pt-6 md:max-w-6xl md:px-6 md:pt-12">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Courses</h1>
        <p className="mt-2 max-w-2xl text-muted md:text-lg">
          The {courses.length} public courses BookOn checks for tee times. Pick one to see
          what&apos;s free over the next week.
        </p>
        {byArea.map((group) => (
          <section key={group.area} aria-labelledby={`area-${group.area}`} className="mt-10">
            <h2 id={`area-${group.area}`} className="text-xl font-semibold">
              {group.area}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-4">
              {group.courses.map((c) => (
                <CourseCard key={c.slug} course={c} />
              ))}
            </div>
          </section>
        ))}
        <p className="mt-10 text-sm text-muted">
          Pictures are illustrations, not photos of the courses.
        </p>
      </main>
    </>
  );
}
