"use server";

import { redirect } from "next/navigation";
import { lessonByToken } from "@bookon/db";
import { PaymentError, cancelLessonByGolfer } from "@bookon/payments";
import { getDb } from "@/lib/db";
import { lessonContext } from "@/lib/lessons";

/** The golfer cancels from the link in their email. The link is their proof it's theirs. */
export async function cancelLessonFromLink(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const booking = await lessonByToken(getDb(), token);
  if (!booking) redirect("/");
  const page = `/lessons/${encodeURIComponent(token)}`;
  const ctx = await lessonContext();
  if (!ctx)
    redirect(
      `${page}?problem=${encodeURIComponent("Cancelling isn't available right now. Please email info@bookon.com.au.")}`,
    );
  try {
    await cancelLessonByGolfer(ctx!, booking!);
  } catch (error) {
    if (error instanceof PaymentError)
      redirect(`${page}?problem=${encodeURIComponent(error.message)}`);
    throw error;
  }
  redirect(`${page}?cancelled=1`);
}
