export const MAX_COURSE_NAME = 50;

/** Korean error for an invalid course name (checked after trimming), or null when it is fine. */
export function courseNameError(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "강의 이름을 입력해 주세요";
  if (trimmed.length > MAX_COURSE_NAME) return "강의 이름은 50자 이하로 해 주세요";
  return null;
}
