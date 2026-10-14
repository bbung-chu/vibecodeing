import type { EventKind } from "@/lib/domain/types";

export const KIND_LABEL: Record<EventKind, string> = {
  midterm: "중간고사",
  final: "기말고사",
  assignment: "과제",
  contest: "공모전",
  personal: "개인",
};

/** Title of a course's midterm/final event, e.g. "운영체제 중간고사". Kept in sync when the course is renamed. */
export const examTitle = (courseName: string, kind: "midterm" | "final") => `${courseName} ${KIND_LABEL[kind]}`;

/** Fixed colors for standalone events; course events use their course color. */
export const STANDALONE_CLASS: Record<"contest" | "personal", string> = {
  contest: "bg-amber-200 text-amber-950",
  personal: "bg-slate-200 text-slate-900",
};

/** An event as the schedule views receive it (serializable). */
export type ScheduleEvent = {
  id: string;
  kind: EventKind;
  title: string;
  courseId: string | null;
  color: string | null;
  dateKey: string; // KST "YYYY-MM-DD"
  time: string; // KST "HH:MM"
  local: string; // KST "YYYY-MM-DDTHH:MM"
  dday: string; // "D-3"
};

export const isStandalone = (e: ScheduleEvent): e is ScheduleEvent & { kind: "contest" | "personal" } =>
  e.kind === "contest" || e.kind === "personal";
