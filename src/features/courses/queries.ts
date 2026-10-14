import "server-only";
import { createServerSupabase, requireUser } from "@/lib/supabase/server";
import type { Course, DayOfWeek } from "@/lib/domain/types";

type SlotRow = { course_id: string; day_of_week: number; start_time: string; end_time: string };
type CourseRow = {
  id: string;
  semester_id: string;
  name: string;
  professor: string | null;
  room: string | null;
  color: string;
  course_slots: SlotRow[];
};

const SELECT = "id, semester_id, name, professor, room, color, course_slots(course_id, day_of_week, start_time, end_time)";

/** Postgres `time` is "HH:MM:SS"; the domain uses "HH:MM". */
const hhmm = (t: string) => t.slice(0, 5);

function toCourse(row: CourseRow): Course {
  return {
    id: row.id,
    semesterId: row.semester_id,
    name: row.name,
    professor: row.professor,
    room: row.room,
    color: row.color,
    slots: row.course_slots
      .map((s) => ({
        courseId: s.course_id,
        dayOfWeek: s.day_of_week as DayOfWeek,
        start: hhmm(s.start_time),
        end: hhmm(s.end_time),
      }))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.start.localeCompare(b.start)),
  };
}

export async function listCourses(semesterId: string): Promise<Course[]> {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("courses")
    .select(SELECT)
    .eq("semester_id", semesterId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as CourseRow[]).map(toCourse);
}

export async function getCourse(id: string): Promise<Course | null> {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("courses")
    .select(SELECT)
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? toCourse(data as CourseRow) : null;
}
