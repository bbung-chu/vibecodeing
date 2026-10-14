import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-next";

describe("safeNextPath", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeNextPath("/timetable")).toBe("/timetable");
    expect(safeNextPath("/materials?x=1#a")).toBe("/materials?x=1#a");
  });

  it.each([
    null,
    "",
    "timetable",
    "//evil.com",
    "/\\evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "/\t/evil.com",
    "/\n/evil.com",
  ])("falls back to / for %j", (next) => {
    expect(safeNextPath(next)).toBe("/");
  });
});
