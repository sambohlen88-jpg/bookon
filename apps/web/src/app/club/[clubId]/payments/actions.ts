"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { acceptEventTerms, acceptedEventTerms } from "@bookon/db";
import { PaymentError, clubPaymentsSetupLink, usableAccount } from "@bookon/payments";
import { requireClub } from "@/lib/access";
import { getDb } from "@/lib/db";
import { lessonContext } from "@/lib/lessons";

/** The club's payments (Milestone 21). Only the club's owner can change them. */

async function ownerOf(formData: FormData) {
  const clubId = String(formData.get("clubId") ?? "");
  const page = `/club/${clubId}/payments`;
  const access = await requireClub(clubId, page);
  const back = (query: Record<string, string>): never =>
    redirect(`${page}?${new URLSearchParams(query)}`);
  if (access.role !== "owner") back({ problem: "Only the club's owner can set up payments." });
  const ctx = await lessonContext();
  if (!ctx) back({ problem: "Payments through BookOn aren't available right now." });
  return { ...access, ctx: ctx!, page, back };
}

/** Agree to the event payment terms (the first time), then go to Stripe to set up or finish. */
export async function setUpClubPayments(formData: FormData) {
  const { club, actor, user, ctx, page, back } = await ownerOf(formData);
  if (!acceptedEventTerms(club)) {
    const by = String(formData.get("termsBy") ?? "")
      .trim()
      .slice(0, 80);
    if (formData.get("terms") !== "yes" || !by)
      back({ problem: "Tick the box and add your name to agree to the payment terms." });
    await acceptEventTerms(getDb(), club.id, by, actor, ctx.now);
  }
  let link: string;
  try {
    const returnUrl = `${ctx.site}${page}?back=1`;
    link = await clubPaymentsSetupLink(ctx, club, user.email, { returnUrl, refreshUrl: returnUrl });
  } catch (error) {
    if (error instanceof PaymentError) back({ problem: error.message });
    throw error;
  }
  revalidatePath(page);
  redirect(link!);
}

export async function openClubStripeDashboard(formData: FormData) {
  const { club, ctx, back } = await ownerOf(formData);
  if (!usableAccount(ctx.payments, club.paymentAccountId)) back({});
  let link: string;
  try {
    link = await ctx.payments.dashboardLink(club.paymentAccountId!);
  } catch (error) {
    if (error instanceof PaymentError) back({ problem: error.message });
    throw error;
  }
  redirect(link!);
}
