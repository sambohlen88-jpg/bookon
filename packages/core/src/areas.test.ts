import { describe, expect, it } from "vitest";
import { AREAS, areaName, distanceKm, formatDistance, isAreaId } from "./areas";

describe("areas", () => {
  it("names areas, with Other for none", () => {
    expect(areaName("peel")).toBe("Mandurah & Peel");
    expect(areaName(null)).toBe("Other");
    expect(isAreaId("south")).toBe(true);
    expect(isAreaId("mars")).toBe(false);
    expect(new Set(AREAS.map((a) => a.id)).size).toBe(AREAS.length);
  });

  it("measures distance in kilometres", () => {
    // One degree of latitude is about 111.2 km anywhere.
    const perth = { latitude: -31.9523, longitude: 115.8613 };
    const south = { latitude: -32.9523, longitude: 115.8613 };
    expect(distanceKm(perth, south)).toBeCloseTo(111.2, 0);
    expect(distanceKm(perth, perth)).toBe(0);
  });

  it("writes distances simply", () => {
    expect(formatDistance(0.04)).toBe("100 m");
    expect(formatDistance(0.83)).toBe("800 m");
    expect(formatDistance(6.24)).toBe("6.2 km");
    expect(formatDistance(123.4)).toBe("123 km");
  });
});
