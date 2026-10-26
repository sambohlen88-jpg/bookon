/** The newsletter tick box on forms (Milestone 27). It starts unticked, as the Spam Act asks. */
import { subscribeNewsletter, type NewsletterSource } from "@bookon/db";
import { getDb } from "@/lib/db";

/** Add them to the newsletter if they ticked the box. */
export async function joinNewsletterIfTicked(
  formData: FormData,
  email: string | null,
  source: NewsletterSource,
): Promise<void> {
  if (formData.get("newsletter") !== "yes" || !email) return;
  await subscribeNewsletter(getDb(), { email, source, now: new Date() });
}
