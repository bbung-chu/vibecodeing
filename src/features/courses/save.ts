import type { SupabaseClient } from "@supabase/supabase-js";
import type { Slot } from "@/lib/domain/types";

type Fields = { name: string; professor: string | null; room: string | null; color: string };

const SLOT_ERROR = "수업 시간을 저장하지 못했어요";
const COURSE_ERROR = "강의를 저장하지 못했어요";

/**
 * Persists a course and replaces its slots without ever leaving it half-saved.
 * Edit: new slots are inserted first, old ones (captured beforehand) deleted after.
 * Create: if the slot insert fails, the just-created course row is removed.
 */
export async function persistCourse(
  client: SupabaseClient,
  userId: string,
  input: { id?: string; semesterId: string; fields: Fields; slots: Slot[] },
): Promise<{ id?: string; error?: string }> {
  let courseId = input.id;
  let oldSlotIds: string[] = [];
  const created = !courseId;

  if (courseId) {
    const { data, error } = await client
      .from("courses")
      .update(input.fields)
      .eq("id", courseId)
      .eq("user_id", userId)
      .eq("semester_id", input.semesterId)
      .select("id")
      .maybeSingle();
    if (error || !data) return { error: COURSE_ERROR };
    const { data: old, error: oldError } = await client
      .from("course_slots")
      .select("id")
      .eq("course_id", courseId)
      .eq("user_id", userId);
    if (oldError) return { error: SLOT_ERROR };
    oldSlotIds = (old ?? []).map((r) => r.id as string);
  } else {
    const { data, error } = await client
      .from("courses")
      .insert({ ...input.fields, user_id: userId, semester_id: input.semesterId })
      .select("id")
      .single();
    if (error) return { error: COURSE_ERROR };
    courseId = data.id as string;
  }

  const { error: insError } = await client.from("course_slots").insert(
    input.slots.map((s) => ({
      user_id: userId,
      course_id: courseId,
      day_of_week: s.dayOfWeek,
      start_time: s.start,
      end_time: s.end,
    })),
  );
  if (insError) {
    if (created) await client.from("courses").delete().eq("id", courseId!).eq("user_id", userId);
    return { error: SLOT_ERROR };
  }

  if (oldSlotIds.length > 0) {
    const { error: delError } = await client
      .from("course_slots")
      .delete()
      .in("id", oldSlotIds)
      .eq("user_id", userId);
    if (delError) return { error: SLOT_ERROR };
  }
  return { id: courseId };
}
