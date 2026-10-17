"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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
  setFavourite,
} from "@bookon/db";
import { createMailer, signInEmail } from "@bookon/email";
import { authToken, clearAuthCookie, currentUser, setAuthCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { parseSearchForm, toSearchParams } from "@/lib/search-form";
import { SESSION_COOKIE, validSessionId } from "@/lib/session";

/**
 * This site's address, for links in emails. In production it comes from
 * BOOKON_SITE_URL, never the request, so a forged Host header can't put
 * another site's address in a sign-in email. Locally it's wherever the site
 * is running, even if BOOKON_SITE_URL was copied from .env.example.
 */
async function siteOrigin(): Promise<string> {
  if (process.env.NODE_ENV === "production") {
    if (!process.env.BOOKON_SITE_URL) throw new Error("BOOKON_SITE_URL must be set in production");
    return process.env.BOOKON_SITE_URL.replace(/\/$/, "");
  }
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
}

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

/** Save the search in `query` (a /search query string) as an alert. */
export async function createAlertFromSearch(formData: FormData) {
  const query = String(formData.get("query") ?? "");
  const back = `/search?${query}`;
  const user = await requireUser(back);
  const db = getDb();
  const now = new Date();
  const slugs = (await listSearchableCourses(db)).map((c) => c.slug);
  const form = parseSearchForm(Object.fromEntries(new URLSearchParams(query)), now, slugs);
  const courses = new URLSearchParams(query).getAll("course").filter((s) => slugs.includes(s));
  const filters = toSearchParams({ ...form, courses }, now);
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
  if (formData.get("confirm") !== "yes") redirect("/account?error=confirm");
  await deleteUser(getDb(), user.id);
  await clearAuthCookie();
  redirect("/?deleted=1");
}
