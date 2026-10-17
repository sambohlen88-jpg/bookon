import { describe, expect, it } from "vitest";
import { formatPrice, parsePriceCents } from "./money";

describe("parsePriceCents", () => {
  it("reads dollar amounts", () => {
    expect(parsePriceCents("$33.00")).toBe(3300);
    expect(parsePriceCents("  $49.5 ")).toBe(4950);
    expect(parsePriceCents("$1,049.50")).toBe(104950);
    expect(parsePriceCents("$30")).toBe(3000);
  });

  it("returns null without a price", () => {
    expect(parsePriceCents("N/A")).toBeNull();
  });
});

describe("formatPrice", () => {
  it("drops cents for whole dollars", () => {
    expect(formatPrice(4000)).toBe("$40");
    expect(formatPrice(2350)).toBe("$23.50");
  });
});
