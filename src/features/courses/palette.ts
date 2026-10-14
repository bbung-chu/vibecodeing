/** Eight Tailwind 400-level hues; new courses take them round-robin. */
export const COURSE_COLORS = [
  "#f87171", // red-400
  "#fb923c", // orange-400
  "#fbbf24", // amber-400
  "#4ade80", // green-400
  "#2dd4bf", // teal-400
  "#60a5fa", // blue-400
  "#818cf8", // indigo-400
  "#c084fc", // purple-400
] as const;

export const DAY_LABELS = ["월", "화", "수", "목", "금"] as const;
export const dayLabel = (d: number) => DAY_LABELS[d - 1];

export function nextColor(courseCount: number): string {
  return COURSE_COLORS[courseCount % COURSE_COLORS.length];
}
