import "server-only";
import { createServerSupabase, requireUser } from "@/lib/supabase/server";

export type FileRow = { id: string; courseId: string; name: string; sizeBytes: number; createdAt: string };

type Row = { id: string; course_id: string; name: string; size_bytes: number | null; created_at: string };

/** The signed-in user's files for a course, newest first. */
export async function listFiles(courseId: string): Promise<FileRow[]> {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("files")
    .select("id, course_id, name, size_bytes, created_at")
    .eq("course_id", courseId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    courseId: r.course_id,
    name: r.name,
    sizeBytes: Number(r.size_bytes ?? 0),
    createdAt: r.created_at,
  }));
}
