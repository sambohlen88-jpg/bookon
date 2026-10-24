import { describe, expect, it } from "vitest";
import { formatAbn } from "./business";

describe("ABNs", () => {
  it("accepts a real-looking ABN and spaces it out", () => {
    // The ATO's own example ABN.
    expect(formatAbn("51824753556")).toBe("51 824 753 556");
    expect(formatAbn("51 824 753 556")).toBe("51 824 753 556");
  });
  it("refuses typos", () => {
    expect(formatAbn("51824753557")).toBeNull();
    expect(formatAbn("1234")).toBeNull();
  });
});
