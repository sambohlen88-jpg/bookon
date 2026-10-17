import { listSearchableCourses, type SearchableCourse } from "@bookon/db";
import { SearchForm } from "@/components/search-form";
import { SiteHeader } from "@/components/site-header";
import { getDb } from "@/lib/db";
import { defaultForm } from "@/lib/search-form";

export const dynamic = "force-dynamic";

export default async function Home() {
  const now = new Date();
  // The form must still show if the database is down; search will explain.
  const courses: SearchableCourse[] = await listSearchableCourses(getDb()).catch(() => []);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 pb-12 pt-6">
        <h1 className="text-3xl font-bold tracking-tight">Find a tee time</h1>
        <p className="mt-2 text-muted">Every Perth public course we check, in one search.</p>
        <div className="mt-6">
          <SearchForm values={defaultForm(now)} courses={courses} now={now} />
        </div>
        {courses.length > 0 && (
          <p className="mt-8 text-sm text-muted">
            Checking {courses.map((c) => c.name.replace(/ Golf Course$/, "")).join(", ")}. More
            courses coming soon.
          </p>
        )}
      </main>
    </>
  );
}
