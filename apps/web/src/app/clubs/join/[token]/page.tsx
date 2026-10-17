import { redirect } from "next/navigation";
import { applicationByToken } from "@bookon/db";
import { clubStepHref } from "@/lib/club-steps";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** The private link from the email: back to the start, or to what was sent. */
export default async function ResumePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const application = await applicationByToken(getDb(), token);
  if (!application) redirect("/clubs/join?error=link");
  redirect(clubStepHref(token, application.status === "draft" ? "club" : "review"));
}
