import "server-only";
import { createServerSupabase, requireUser } from "@/lib/supabase/server";
import type { AppEvent, EventKind } from "@/lib/domain/types";

type EventRow = {
  id: string;
  course_id: string | null;
  kind: EventKind;
  title: string;
  starts_at: string;
  courses: { name: string; color: string } | null;
};

export type EventWithCourse = AppEvent & { courseName: string | null; color: string | null };

/** The signed-in user's events, soonest first. `range` (ISO UTC) filters on starts_at, inclusive. */
export async function listEvents(range?: { from: string; to: string }): Promise<EventWithCourse[]> {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  let query = supabase
    .from("events")
    .select("id, course_id, kind, title, starts_at, courses(name, color)")
    .eq("user_id", user.id);
  if (range) query = query.gte("starts_at", range.from).lte("starts_at", range.to);
  const { data, error } = await query.order("starts_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as EventRow[]).map((row) => ({
    id: row.id,
    courseId: row.course_id,
    kind: row.kind,
    title: row.title,
    startsAt: new Date(row.starts_at).toISOString(),
    courseName: row.courses?.name ?? null,
    color: row.courses?.color ?? null,
  }));
}

/** Events of one course (midterm, final, assignments), soonest first. */
export async function listCourseEvents(courseId: string): Promise<AppEvent[]> {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("events")
    .select("id, course_id, kind, title, starts_at")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    courseId: row.course_id,
    kind: row.kind as EventKind,
    title: row.title,
    startsAt: new Date(row.starts_at).toISOString(),
  }));
}
