/** Small pieces shared by the admin area and club logins. */

export const tableClass = "w-full border-collapse text-sm";
export const thClass = "border-b border-border px-3 py-2 text-left font-semibold whitespace-nowrap";
export const tdClass = "border-b border-border px-3 py-2 align-top";
export const panel = "rounded-xl border border-border p-4 md:p-6";

export function PageTitle({ title, intro }: { title: string; intro?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      {intro && <p className="mt-1 text-muted">{intro}</p>}
    </div>
  );
}

export function Pill({
  tone,
  children,
}: {
  tone: "good" | "warn" | "muted";
  children: React.ReactNode;
}) {
  const colours =
    tone === "good"
      ? "border-brand text-brand"
      : tone === "warn"
        ? "border-warning-border bg-warning-bg text-warning-fg"
        : "border-border text-muted";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colours}`}
    >
      {children}
    </span>
  );
}
