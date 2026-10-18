import type { listChangeRequests } from "@bookon/db";
import { approveRequest, declineRequest } from "@/app/admin/actions";
import { panel } from "@/components/admin/ui";
import { primaryButton, secondaryButton } from "@/components/ui";

/** Booking page changes clubs asked for, with approve and decline buttons. */
export function ChangeRequests({
  requests,
}: {
  requests: Awaited<ReturnType<typeof listChangeRequests>>;
}) {
  return (
    <section className={`${panel} mb-6`} aria-labelledby="requests">
      <h2 id="requests" className="text-lg font-semibold">
        Booking page changes to check
      </h2>
      <p className="mt-1 text-sm text-muted">
        A new booking page changes where BookOn reads times and sends golfers. Check it&apos;s the
        club&apos;s real public booking page before approving.
      </p>
      <ul className="mt-3 flex flex-col gap-3">
        {requests.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0"
          >
            <span className="min-w-0 text-sm">
              <span className="font-medium">
                {r.clubName}
                {r.courseName ? ` · ${r.courseName}` : ""}
              </span>
              <a
                href={r.value}
                target="_blank"
                rel="noopener noreferrer"
                className="block break-all text-brand underline"
              >
                {r.value}
              </a>
              <span className="text-muted">Asked by {r.requestedBy}</span>
            </span>
            <form className="flex gap-2">
              <input type="hidden" name="id" value={r.id} />
              <button formAction={approveRequest} className={primaryButton}>
                Approve
              </button>
              <button formAction={declineRequest} className={secondaryButton}>
                Decline
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
