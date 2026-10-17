import { alertFilters, type Alert } from "@bookon/db";
import { describeSearch } from "@bookon/email";

const STATUS: Record<Alert["status"], string> = {
  pending: "Waiting",
  active: "On",
  paused: "Paused",
  deleted: "Deleted",
  ended: "Ended",
};

/** "Sun 18 Oct · 6:00 am to 12:00 pm · 2 players · 18 holes", plus which courses. */
export function AlertSummary({
  alert,
  courseNames,
}: {
  alert: Alert;
  courseNames: Map<string, string>;
}) {
  const filters = alertFilters(alert);
  const courses = filters.courseSlugs?.map((s) => courseNames.get(s) ?? s) ?? [];
  return (
    <div>
      <p className="font-medium">{describeSearch(filters)}</p>
      <p className="text-sm text-muted">
        {courses.length > 0 ? courses.join(", ") : "Any course"} · {STATUS[alert.status]}
      </p>
    </div>
  );
}
