/** An ABN, as "51 824 753 556", if it's 11 digits and passes the ABN check; otherwise null. */
export function formatAbn(text: string): string | null {
  const digits = text.replace(/\s/g, "");
  if (!/^\d{11}$/.test(digits)) return null;
  // The Australian Business Register's check: subtract 1 from the first digit, weight, divide by 89.
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const sum = [...digits].reduce(
    (total, d, i) => total + (Number(d) - (i === 0 ? 1 : 0)) * weights[i]!,
    0,
  );
  if (sum % 89 !== 0) return null;
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
}
