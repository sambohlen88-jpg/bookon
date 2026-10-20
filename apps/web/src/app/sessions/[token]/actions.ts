"use server";

import { redirect } from "next/navigation";
import { groupBookingByToken } from "@bookon/db";
import { PaymentError, cancelGroupByGolfer } from "@bookon/payments";
import { getDb } from "@/lib/db";
import { lessonContext } from "@/lib/lessons";

/** The golfer cancels their spots from the link in their email. The link is their proof it's theirs. */
export async function cancelGroupFromLink(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const booking = await groupBookingByToken(getDb(), token);
  if (!booking) redirect("/");
  const page = `/sessions/${encodeURIComponent(token)}`;
  const ctx = await lessonContext();
  if (!ctx)
    redirect(
      `${page}?problem=${encodeURIComponent("Cancelling isn't available right now. Please email info@bookon.com.au.")}`,
    );
  try {
    await cancelGroupByGolfer(ctx!, booking!);
  } catch (error) {
    if (error instanceof PaymentError)
      redirect(`${page}?problem=${encodeURIComponent(error.message)}`);
    throw error;
  }
  redirect(`${page}?cancelled=1`);
}
