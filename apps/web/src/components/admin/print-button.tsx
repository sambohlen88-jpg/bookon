"use client";

import { primaryButton } from "@/components/ui";

/** Opens the browser's print dialog, where "Save as PDF" makes a PDF. */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={primaryButton}>
      Print or save as PDF
    </button>
  );
}
