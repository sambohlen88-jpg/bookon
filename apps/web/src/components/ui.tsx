/** Shared button and notice styles. Colours come from the tokens in globals.css. */
export const primaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-lg bg-brand px-4 text-base font-semibold text-brand-foreground";
export const secondaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium";
export const textInput =
  "w-full min-h-12 rounded-lg border border-border bg-background px-3 text-base text-foreground";

export function Notice({
  tone,
  children,
}: {
  tone: "info" | "warning";
  children: React.ReactNode;
}) {
  const colours =
    tone === "info"
      ? "border-info-border bg-info-bg text-info-fg"
      : "border-warning-border bg-warning-bg text-warning-fg";
  return (
    <p role="status" className={`rounded-lg border px-3 py-2 text-sm ${colours}`}>
      {children}
    </p>
  );
}
