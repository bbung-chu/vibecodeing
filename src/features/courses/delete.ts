import type { SupabaseClient } from "@supabase/supabase-js";
import { removeCourseObjects } from "@/lib/supabase/storage";

/** Removes the course's storage objects first, then the row (DB cascade clears slots/events/files). */
export async function deleteCourseWithObjects(
  client: SupabaseClient,
  userId: string,
  courseId: string,
): Promise<void> {
  await removeCourseObjects(client, userId, [courseId]);
  const { error } = await client.from("courses").delete().eq("id", courseId).eq("user_id", userId);
  if (error) throw error;
}
