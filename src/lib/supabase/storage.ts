import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "materials";
const PAGE_SIZE = 100;

/**
 * Removes every object under `{userId}/{courseId}/` for each course.
 * DB cascades do not touch storage, so course/semester deletion calls this.
 */
export async function removeCourseObjects(
  client: SupabaseClient,
  userId: string,
  courseIds: string[],
): Promise<void> {
  for (const courseId of courseIds) {
    const prefix = `${userId}/${courseId}`;
    // Always list from offset 0: removed objects shift the remainder forward.
    for (;;) {
      const { data, error } = await client.storage
        .from(BUCKET)
        .list(prefix, { limit: PAGE_SIZE, offset: 0 });
      if (error) throw error;
      const names = (data ?? []).filter((o) => o.id !== null).map((o) => `${prefix}/${o.name}`);
      if (names.length === 0) break;
      const { error: removeError } = await client.storage.from(BUCKET).remove(names);
      if (removeError) throw removeError;
      if ((data ?? []).length < PAGE_SIZE) break;
    }
  }
}
