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
          <details className="mt-8 text-sm text-muted">
            <summary className="min-h-11 cursor-pointer py-3">
              Checking {courses.length} courses across Perth and WA
            </summary>
            <ul className="columns-2 gap-4">
              {courses.map((c) => (
                <li key={c.slug} className="py-0.5">
                  {c.name.replace(
                    / (Golf (Course|Club|Links)|Country Club|Golf & Country Club)$/,
                    "",
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </main>
    </>
  );
}
