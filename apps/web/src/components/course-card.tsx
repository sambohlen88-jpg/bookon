import Link from "next/link";
import { CourseArt } from "@/components/course-art";
import { areaName } from "@bookon/core";

/** A course in a gallery: its picture, name and where it is. Links to the course page. */
export function CourseCard({
  course,
  photoId = null,
}: {
  course: { slug: string; name: string; suburb: string; area?: string | null; holes?: number };
  photoId?: string | null;
}) {
  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group block overflow-hidden rounded-xl border border-border bg-background transition-shadow hover:shadow-lg"
    >
      <CourseArt slug={course.slug} photoId={photoId} className="aspect-video w-full" />
      <div className="p-4">
        <p className="font-semibold leading-tight group-hover:text-brand">{course.name}</p>
        <p className="mt-1 text-sm text-muted">
          {course.suburb} · {areaName(course.area)}
          {course.holes ? ` · ${course.holes} holes` : ""}
        </p>
      </div>
    </Link>
  );
}
