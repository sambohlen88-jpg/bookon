"use server";

import { redirect } from "next/navigation";
import { entryByToken } from "@bookon/db";
import { PaymentError, withdrawEntryByGolfer } from "@bookon/payments";
import { getDb } from "@/lib/db";
import { lessonContext } from "@/lib/lessons";

/** The golfer withdraws from the link in their email. The link is their proof it's theirs. */
export async function withdrawFromLink(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const entry = await entryByToken(getDb(), token);
  if (!entry) redirect("/");
  const page = `/entries/${encodeURIComponent(token)}`;
  const ctx = await lessonContext();
  if (!ctx)
    redirect(
      `${page}?problem=${encodeURIComponent("Withdrawing isn't available right now. Please contact the club.")}`,
    );
  try {
    await withdrawEntryByGolfer(ctx!, entry!);
  } catch (error) {
    if (error instanceof PaymentError)
      redirect(`${page}?problem=${encodeURIComponent(error.message)}`);
    throw error;
  }
  redirect(`${page}?withdrawn=1`);
}
