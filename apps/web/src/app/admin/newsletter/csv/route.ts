import { formatPerthDay, formatPerthTime, perthDate } from "@bookon/core";
import { NEWSLETTER_SOURCES, listNewsletterSubscribers } from "@bookon/db";
import { isAdminRequest } from "@/lib/access";
import { getDb } from "@/lib/db";
import { csvCell } from "@/lib/report";

export const dynamic = "force-dynamic";

const when = (d: Date | null) => (d ? `${formatPerthDay(perthDate(d))} ${formatPerthTime(d)}` : "");

/** Everyone who's asked for the newsletter, with their consent (Milestone 27). Admin only. */
export async function GET() {
  if (!(await isAdminRequest())) return new Response("Not found", { status: 404 });
  const rows = [
    [
      "Email",
      "Status",
      "Joined from",
      "Agreed to",
      "Agreed at (Perth)",
      "Unsubscribed at (Perth)",
      "Unsubscribed via",
    ],
    ...(await listNewsletterSubscribers(getDb())).map((s) => [
      s.email,
      s.status,
      NEWSLETTER_SOURCES[s.source as keyof typeof NEWSLETTER_SOURCES] ?? s.source,
      s.consentText,
      when(s.consentedAt),
      when(s.unsubscribedAt),
      s.unsubscribedVia ?? "",
    ]),
  ];
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  return new Response(`${csv}\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="bookon-newsletter-${perthDate(new Date())}.csv"`,
    },
  });
}
