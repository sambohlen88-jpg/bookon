"use server";

import { cookies } from "next/headers";
import { createShare, listSearchableCourses, searchTeeTimes, shareContentFrom } from "@bookon/db";
import { getDb } from "@/lib/db";
import { parseSearchForm, searchHref, toSearchParams } from "@/lib/search-form";
import { SESSION_COOKIE, validSessionId } from "@/lib/session";
import { shareText, shareTitle, type ShareLink } from "@/lib/share";
import { siteOrigin } from "@/lib/site";

/**
 * Freeze a search's times into a share link. The search is run again here
 * from its query, so a share only ever holds times BookOn found itself.
 * `course` narrows it to one course.
 */
export async function createShareLink(
  query: string,
  course: string | null,
): Promise<ShareLink | { error: string }> {
  const db = getDb();
  const now = new Date();
  const courses = await listSearchableCourses(db);
  const slugs = courses.map((c) => c.slug);
  const search = new URLSearchParams(query.replace(/^\/search\?/, ""));
  const form = parseSearchForm(
    {
      ...Object.fromEntries(search),
      course: search.getAll("course"),
    },
    now,
    slugs,
  );
  if (course) {
    if (!slugs.includes(course)) return { error: "That course isn't on BookOn any more." };
    form.courses = [course];
  }
  const params = toSearchParams(form, now);
  const content = shareContentFrom(
    await searchTeeTimes(db, params, now),
    params,
    searchHref(form).replace(/^\/search\?/, ""),
  );
  const sessionId = validSessionId((await cookies()).get(SESSION_COOKIE)?.value);
  const made = await createShare(db, { sessionId, content, now });
  if ("error" in made) {
    return {
      error:
        made.error === "limit"
          ? "You've shared a lot in the last hour. Try again a bit later."
          : "These times have gone. Search again to share the latest.",
    };
  }
  const url = `${await siteOrigin()}/s/${made.code}`;
  return { code: made.code, url, title: shareTitle(params), text: shareText(content, url) };
}
