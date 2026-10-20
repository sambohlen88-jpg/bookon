"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { formatPerthDay, formatPerthTime, perthDate } from "@bookon/core";
import {
  GroupSessionClash,
  coachForEmail,
  createGroupSessions,
  groupSessionById,
  type Coach,
} from "@bookon/db";
import {
  PaymentError,
  cancelGroupSessionByCoach,
  coachTakesBookings,
  placeLabel,
} from "@bookon/payments";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { parseGroupSessionForm } from "@/lib/group-form";
import { lessonContext } from "@/lib/lessons";

/** Group sessions in My coaching (Milestone 19). Every action checks it's the coach's own. */

function back(query: Record<string, string>): never {
  redirect(`/coach?${new URLSearchParams(query)}#sessions`);
}

async function signedInCoach(): Promise<Coach> {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/coach");
  const coach = await coachForEmail(getDb(), user!.email);
  if (!coach || coach.status !== "live" || !coach.profile)
    back({ problem: "Your listing needs to be live first." });
  return coach!;
}

async function context() {
  const ctx = await lessonContext();
  if (!ctx) back({ problem: "Payments through BookOn aren't available right now." });
  return ctx!;
}

const when = (d: Date) => `${formatPerthDay(perthDate(d))} ${formatPerthTime(d)}`;

export async function addGroupSession(formData: FormData) {
  const coach = await signedInCoach();
  const ctx = await context();
  if (!(await coachTakesBookings(ctx, coach)))
    back({ problem: "Turn on bookings through BookOn first, so golfers can pay for spots." });
  const { input, problems } = parseGroupSessionForm(
    formData,
    coach.profile!.places.map(placeLabel),
    ctx.now,
    perthDate(ctx.now),
  );
  if (!input) back({ problem: problems.join(" ") });
  try {
    const made = await createGroupSessions(ctx.db, { ...input!, coachId: coach.id }, ctx.now);
    revalidatePath("/coach");
    back({ sessions: String(made.length) });
  } catch (error) {
    if (error instanceof GroupSessionClash)
      back({
        problem: `Nothing added: that clashes with a lesson, a blocked-out time or another session on ${error.starts.map(when).join(", ")}.`,
      });
    throw error;
  }
}

/** Call off one session: everyone who booked is refunded in full. */
export async function cancelGroupSessionFromPortal(formData: FormData) {
  const coach = await signedInCoach();
  const ctx = await context();
  const session = await groupSessionById(ctx.db, String(formData.get("id") ?? ""));
  if (!session || session.coachId !== coach.id) back({ problem: "That session wasn't found." });
  const note =
    String(formData.get("note") ?? "")
      .trim()
      .slice(0, 300) || null;
  try {
    const result = await cancelGroupSessionByCoach(ctx, session!, note);
    if (!result) back({ problem: "That session was already cancelled." });
  } catch (error) {
    if (error instanceof PaymentError) back({ problem: error.message });
    throw error;
  }
  revalidatePath("/coach");
  back({ sessionCancelled: "1" });
}
