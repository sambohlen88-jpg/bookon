/** Parse a dollar amount such as "$33.00" or "$1,049.50" into cents. */
export function parsePriceCents(text: string): number | null {
  const match = /\$\s*([\d,]+)(?:\.(\d{1,2}))?/.exec(text);
  if (!match) return null;
  const dollars = Number(match[1]!.replace(/,/g, ""));
  const cents = Number((match[2] ?? "0").padEnd(2, "0"));
  return dollars * 100 + cents;
}

/** "$40" for whole dollars, "$40.50" otherwise. */
export function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}
