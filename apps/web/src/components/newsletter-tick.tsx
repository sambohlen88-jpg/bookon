import { NEWSLETTER_CONSENT } from "@bookon/db";
import { Checkbox } from "@/components/form";

/** "Send me BookOn news…" (Milestone 27). Never ticked to start with. */
export function NewsletterTick() {
  return (
    <Checkbox name="newsletter" value="yes">
      {NEWSLETTER_CONSENT}
    </Checkbox>
  );
}
