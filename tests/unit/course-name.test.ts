import { describe, expect, it } from "vitest";
import { courseNameError } from "@/features/courses/name";

describe("courseNameError", () => {
  it("asks for a name when blank", () => {
    expect(courseNameError("")).toBe("강의 이름을 입력해 주세요");
    expect(courseNameError("   ")).toBe("강의 이름을 입력해 주세요");
  });
  it("rejects names over 50 characters with their own message", () => {
    expect(courseNameError("가".repeat(51))).toBe("강의 이름은 50자 이하로 해 주세요");
  });
  it("accepts 1 to 50 characters", () => {
    expect(courseNameError("운영체제")).toBeNull();
    expect(courseNameError("가".repeat(50))).toBeNull();
  });
});
