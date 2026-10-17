import { courseArtUrl } from "@/lib/course-art";

/**
 * A course's approved photo, or its illustrated landscape. A cached image rather than inline
 * drawing, so phones don't download pictures only desktop shows (lazy images
 * that are hidden are never fetched).
 */
export function CourseArt({
  slug,
  className = "",
  wide = false,
  eager = false,
  photoId = null,
}: {
  slug: string;
  className?: string;
  /** A long band (such as under the home page banner) rather than a card picture. */
  wide?: boolean;
  /** At the top of the page: load straight away. */
  eager?: boolean;
  /** A photo the club supplied and BookOn approved, shown instead of the drawing. */
  photoId?: string | null;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoId ? `/photos/${photoId}.webp` : courseArtUrl(slug, wide)}
      alt=""
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={`block object-cover ${className}`}
    />
  );
}
