import { describe, expect, it } from "vitest";
import { containsPoint, GROUND_Y, initialCity } from "./city.ts";
import type { Building } from "./types.ts";

// The attachment rule: a rope lands anywhere on a building face, and nowhere
// else. This hit test is what makes "click any surface" work, so it gets its
// own test.
describe("containsPoint", () => {
  const building: Building = { x: 100, width: 200, height: 500 };
  const top = GROUND_Y - building.height; // 100

  it("accepts a point in the middle of the facade", () => {
    expect(containsPoint(building, { x: 200, y: 300 })).toBe(true);
  });

  it("accepts points on the roof line and at the base", () => {
    expect(containsPoint(building, { x: 200, y: top })).toBe(true);
    expect(containsPoint(building, { x: 200, y: GROUND_Y })).toBe(true);
  });

  it("rejects sky above the roof and ground below the base", () => {
    expect(containsPoint(building, { x: 200, y: top - 1 })).toBe(false);
    expect(containsPoint(building, { x: 200, y: GROUND_Y + 1 })).toBe(false);
  });

  it("rejects the street either side", () => {
    expect(containsPoint(building, { x: 99, y: 300 })).toBe(false);
    expect(containsPoint(building, { x: 301, y: 300 })).toBe(false);
  });
});

describe("initialCity", () => {
  it("marks the first building with a bullseye and leaves the rest unmarked", () => {
    const city = initialCity();
    expect(city[0].bullseye).toBeTruthy();
    expect(city.slice(1).every((b) => b.bullseye === undefined)).toBe(true);
  });

  it("puts the bullseye on the first building's face, where it can be grabbed", () => {
    const city = initialCity();
    expect(containsPoint(city[0], city[0].bullseye!)).toBe(true);
  });

  it("leaves a gap between every building", () => {
    const city = initialCity();
    for (let i = 1; i < city.length; i++) {
      expect(city[i].x).toBeGreaterThan(city[i - 1].x + city[i - 1].width);
    }
  });
});
