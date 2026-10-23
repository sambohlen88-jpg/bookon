"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { validStars } from "@bookon/core";
import {
  alertByManageToken,
  clearVisits,
  consumeSignInToken,
  createAlert,
  createSignInToken,
  deleteUser,
  endSession,
  listAlerts,
  listPushSubscriptions,
  listSearchableCourses,
  normaliseEmail,
  safeNextPath,
  setAlertChannels,
  setAlertStatus,
  removeCourseRating,
  setCourseRating,
  setFavourite,
} from "@bookon/db";
import { createMailer, signInEmail } from "@bookon/email";
import { authToken, clearAuthCookie, currentUser, setAuthCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { siteOrigin } from "@/lib/site";
import { parseSearchForm, toSearchParams } from "@/lib/search-form";
import { SESSION_COOKIE, validSessionId } from "@/lib/session";

export async function requestSignIn(formData: FormData) {
  const email = normaliseEmail(String(formData.get("email") ?? ""));
  const next = safeNextPath(String(formData.get("next") ?? "")) ?? "";
  const back = (error: string) =>
    redirect(`/signin?error=${error}${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  if (!email) back("email");

  const db = getDb();
  const result = await createSignInToken(db, email!, next || null, new Date());
  if ("error" in result) back("limit");
  const { token } = result as { token: string };
  const link = `${await siteOrigin()}/auth/callback?token=${encodeURIComponent(token)}`;
  await createMailer(db).send(signInEmail(email!, link));
  redirect(`/signin?sent=${encodeURIComponent(email!)}`);
}

export async function completeSignIn(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const sessionId = validSessionId((await cookies()).get(SESSION_COOKIE)?.value);
  const result = await consumeSignInToken(getDb(), token, sessionId, new Date());
  if (!result) redirect("/signin?error=expired");
  await setAuthCookie(result!.sessionToken);
  redirect(result!.next ?? "/account");
}

export async function signOut() {
  const token = await authToken();
  if (token) await endSession(getDb(), token);
  await clearAuthCookie();
  redirect("/");
}

async function requireUser(next: string) {
  const user = await currentUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(next)}`);
  return user!;
}

export async function toggleFavourite(formData: FormData) {
  const back = safeNextPath(String(formData.get("back") ?? "")) ?? "/search";
  const user = await requireUser(back);
  await setFavourite(
    getDb(),
    user.id,
    String(formData.get("courseId")),
    formData.get("on") === "1",
    new Date(),
  );
  revalidatePath("/search");
  revalidatePath("/account");
}

/** Rate a course 1 to 5 stars, or change the rating (Milestone 20). */
export async function rateCourse(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const back = `/courses/${encodeURIComponent(slug)}`;
  const user = await requireUser(`${back}#rating`);
  const stars = Number(formData.get("stars"));
  const course = (await listSearchableCourses(getDb())).find(
    (c) => c.id === String(formData.get("courseId")) && c.slug === slug,
  );
  if (!course || !validStars(stars)) redirect(back);
  await setCourseRating(getDb(), user.id, course!.id, stars, new Date());
  revalidatePath(back);
  redirect(`${back}?rated=${stars}#rating`);
}

export async function removeMyRating(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const back = `/courses/${encodeURIComponent(slug)}`;
  const user = await requireUser(`${back}#rating`);
  await removeCourseRating(getDb(), user.id, String(formData.get("courseId")));
  revalidatePath(back);
  redirect(`${back}?rated=removed#rating`);
}

/** Save the search in `query` (a /search query string) as an alert. */
export async function createAlertFromSearch(formData: FormData) {
  const query = String(formData.get("query") ?? "");
  const back = `/search?${query}`;
  const user = await requireUser(back);
  const db = getDb();
  const now = new Date();
  const known = await listSearchableCourses(db);
  const slugs = known.map((c) => c.slug);
  const search = new URLSearchParams(query);
  const form = parseSearchForm(
    { ...Object.fromEntries(search), course: search.getAll("course") },
    now,
    slugs,
    Object.fromEntries(known.map((c) => [c.slug, c.area])),
    Object.fromEntries(known.map((c) => [c.slug, c.kind])),
  );
  // Alerts are for tee times only, for now.
  if (form.play === "bays") redirect(back);
  const filters = toSearchParams(form, now);
  // Golfers who allowed notifications on a device get them for new alerts too.
  const push = (await listPushSubscriptions(db, user.id)).length > 0;
  const result = await createAlert(db, {
    userId: user.id,
    email: user.email,
    filters,
    now,
    push,
  });
  redirect(`${back}&alert=${"error" in result ? "limit" : "created"}`);
}

export async function changeAlert(formData: FormData) {
  const user = await requireUser("/account");
  const alertId = String(formData.get("alertId"));
  const status = String(formData.get("status"));
  if (status !== "active" && status !== "paused" && status !== "deleted") return;
  const db = getDb();
  if (!(await listAlerts(db, user.id)).some((a) => a.id === alertId)) return;
  await setAlertStatus(db, alertId, status);
  revalidatePath("/account");
}

/** Turn email or push on or off for one alert. One of them always stays on. */
export async function changeAlertChannel(formData: FormData) {
  const user = await requireUser("/account");
  const alertId = String(formData.get("alertId"));
  const channel = String(formData.get("channel"));
  const on = formData.get("on") === "1";
  if (channel !== "email" && channel !== "push") return;
  const db = getDb();
  const alert = (await listAlerts(db, user.id)).find((a) => a.id === alertId);
  if (!alert) return;
  await setAlertChannels(db, alertId, {
    email: channel === "email" ? on : alert.notifyEmail,
    push: channel === "push" ? on : alert.notifyPush,
  });
  revalidatePath("/account");
}

/** From the link in every alert email; works without signing in. */
export async function changeAlertByToken(formData: FormData) {
  const token = String(formData.get("token"));
  const status = String(formData.get("status"));
  if (status !== "active" && status !== "paused" && status !== "deleted") return;
  const db = getDb();
  const alert = await alertByManageToken(db, token);
  if (!alert) return;
  await setAlertStatus(db, alert.id, status);
  revalidatePath(`/alerts/${token}`);
}

export async function clearMyVisits() {
  const user = await requireUser("/account");
  await clearVisits(getDb(), user.id);
  revalidatePath("/account");
}

export async function deleteMyAccount(formData: FormData) {
  const user = await requireUser("/account");
  if (formData.get("confirm") !== "yes") redirect("/account?tab=settings&error=confirm");
  await deleteUser(getDb(), user.id);
  await clearAuthCookie();
  redirect("/?deleted=1");
}
