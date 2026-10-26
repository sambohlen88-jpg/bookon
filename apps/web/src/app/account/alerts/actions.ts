"use server";

import { redirect } from "next/navigation";
import { createAlert, listPushSubscriptions, listSearchableCourses, updateAlert } from "@bookon/db";
import { currentUser } from "@/lib/auth";
import { parseAlertForm } from "@/lib/alert-form";
import { getDb } from "@/lib/db";

type State = { problems: string[] };

/** Add an alert from My account or a course page's bell (Milestone 28). */
export async function addAlert(_state: State, formData: FormData): Promise<State> {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/account/alerts/new");
  const db = getDb();
  const now = new Date();
  const { filters, problems } = parseAlertForm(formData, await listSearchableCourses(db), now);
  if (!filters) return { problems };
  // Golfers who allowed notifications on a device get them for new alerts too.
  const push = (await listPushSubscriptions(db, user!.id)).length > 0;
  const result = await createAlert(db, {
    userId: user!.id,
    email: user!.email,
    filters,
    now,
    push,
  });
  if ("error" in result)
    return { problems: ["You have 10 alerts already. Delete one you don't need, then try again."] };
  redirect("/account?tab=alerts&alert=added#alerts");
}

/** Save changes to one of the golfer's alerts. */
export async function saveAlert(_state: State, formData: FormData): Promise<State> {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/account?tab=alerts");
  const db = getDb();
  const now = new Date();
  const { filters, problems } = parseAlertForm(formData, await listSearchableCourses(db), now);
  if (!filters) return { problems };
  const saved = await updateAlert(db, {
    alertId: String(formData.get("alertId") ?? ""),
    userId: user!.id,
    filters,
    now,
  });
  if (!saved) redirect("/account?tab=alerts");
  redirect("/account?tab=alerts&alert=saved#alerts");
}
