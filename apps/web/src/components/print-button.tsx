"use client";

import { secondaryButton } from "@/components/ui";

/** Opens the browser's print dialog (or Save as PDF). */
export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`${secondaryButton} print:hidden`}
    >
      {label}
    </button>
  );
}
