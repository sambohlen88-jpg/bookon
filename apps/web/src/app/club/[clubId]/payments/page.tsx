import { formatPrice } from "@bookon/core";
import { EVENT_TERMS, acceptedEventTerms, eventPaymentSettings } from "@bookon/db";
import { refreshClubPayments } from "@bookon/payments";
import { openClubStripeDashboard, setUpClubPayments } from "@/app/club/[clubId]/payments/actions";
import { PageTitle, panel } from "@/components/admin/ui";
import { Checkbox } from "@/components/form";
import { Notice, primaryButton, secondaryButton, textInput } from "@/components/ui";
import { requireClub } from "@/lib/access";
import { getDb } from "@/lib/db";
import { lessonContext } from "@/lib/lessons";

/** The club's payments for event entries (Milestone 21). Only the owner can change them. */
export default async function ClubPayments({
  params,
  searchParams,
}: {
  params: Promise<{ clubId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { clubId } = await params;
  const { club, role } = await requireClub(clubId, `/club/${clubId}/payments`);
  const query = await searchParams;
  const ctx = await lessonContext();
  // Back from Stripe, or part-way through: ask Stripe whether the account is ready now.
  if (ctx && club.paymentAccountId && !club.paymentsReady) {
    try {
      club.paymentsReady = await refreshClubPayments(ctx, club);
    } catch {
      // Stripe didn't answer; checked again next time.
    }
  }
  const { feeCents, enabled } = await eventPaymentSettings(getDb());
  const terms = acceptedEventTerms(club);
  const owner = role === "owner";

  return (
    <>
      <PageTitle
        title="Payments"
        intro="Take entries and payments for your events on BookOn. Entry fees go straight to the club's bank account through Stripe."
      />
      {query.problem && (
        <div className="mb-4">
          <Notice tone="warning">{query.problem}</Notice>
        </div>
      )}
      <section className={`${panel} flex flex-col gap-3`}>
        {!ctx || !enabled ? (
          <p className="text-muted">Payments through BookOn aren&apos;t available right now.</p>
        ) : club.paymentsReady && terms ? (
          <>
            <p>
              <strong>Ready.</strong> Golfers can enter and pay for your events. Stripe pays the
              entry fees to the club, usually within two business days.
            </p>
            <p className="text-sm text-muted">
              Golfers pay a {formatPrice(feeCents)} booking fee on top of each entry, which keeps
              BookOn going. The club gets its full entry fees.
            </p>
            {owner && (
              <form action={openClubStripeDashboard}>
                <input type="hidden" name="clubId" value={club.id} />
                <button type="submit" className={secondaryButton}>
                  Payouts and receipts (Stripe)
                </button>
              </form>
            )}
          </>
        ) : owner ? (
          <form action={setUpClubPayments} className="flex flex-col gap-3">
            <input type="hidden" name="clubId" value={club.id} />
            <p>
              Set up payments once, then put on events golfers can enter and pay for online. Entry
              fees go to the club; golfers pay BookOn&apos;s {formatPrice(feeCents)} booking fee on
              top.
            </p>
            <p className="text-sm text-muted">
              {club.paymentAccountId
                ? "You've started setting up with Stripe. Finish it to take entries."
                : "Stripe, who handle payments for BookOn, will ask for the club's ABN, a contact's ID and the bank account. It takes about 10 minutes. BookOn never sees the bank details."}
            </p>
            {!terms && (
              <div className="rounded-lg border border-border bg-surface p-3 text-sm">
                <p>{EVENT_TERMS}</p>
                <Checkbox name="terms" value="yes">
                  I agree, for the club
                </Checkbox>
                <label htmlFor="terms-by" className="mb-1.5 block font-medium">
                  Your name
                </label>
                <input id="terms-by" name="termsBy" maxLength={80} className={textInput} />
              </div>
            )}
            <button type="submit" className={`${primaryButton} self-start`}>
              {club.paymentAccountId
                ? "Finish setting up with Stripe"
                : "Set up payments with Stripe"}
            </button>
            {ctx.payments.kind === "practice" && (
              <p className="text-sm text-muted">
                Practice mode: no Stripe account is made on this computer.
              </p>
            )}
          </form>
        ) : (
          <p className="text-muted">
            Payments aren&apos;t set up yet. The club&apos;s owner can set them up here.
          </p>
        )}
      </section>
    </>
  );
}
