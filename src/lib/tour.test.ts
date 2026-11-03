import { describe, expect, it } from "vitest";
import { chapterAt, fcfa } from "./tour";

describe("tour", () => {
  it("formats FCFA with space thousands", () => {
    expect(fcfa(4374000)).toBe("4 374 000");
    expect(fcfa(-876000)).toBe("-876 000");
  });
  it("maps scroll to chapters", () => {
    expect(chapterAt(0.2)).toBe(-1);
    expect(chapterAt(0.4)).toBe(0);
    expect(chapterAt(0.55)).toBe(1);
    expect(chapterAt(0.7)).toBe(2);
    expect(chapterAt(0.85)).toBe(3);
    expect(chapterAt(0.97)).toBe(3);
  });
});
