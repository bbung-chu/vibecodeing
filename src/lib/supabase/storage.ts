import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "materials";
const PAGE_SIZE = 100;

/** Every object path under `prefix`, walking sub-folders and paging through each listing. */
async function listObjectPaths(client: SupabaseClient, prefix: string): Promise<string[]> {
  const paths: string[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client.storage
      .from(BUCKET)
      .list(prefix, { limit: PAGE_SIZE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    const page = data ?? [];
    for (const entry of page) {
      const path = `${prefix}/${entry.name}`;
      // Folders come back with a null id.
      if (entry.id === null) paths.push(...(await listObjectPaths(client, path)));
      else paths.push(path);
    }
    if (page.length < PAGE_SIZE) return paths;
  }
}

/**
 * Removes every object under `prefix` (recursively). Lists everything first, then removes in
 * chunks, and throws on any error or when storage removed fewer objects than were listed.
 */
export async function removeObjectsUnder(client: SupabaseClient, prefix: string): Promise<void> {
  const paths = await listObjectPaths(client, prefix);
  for (let i = 0; i < paths.length; i += PAGE_SIZE) {
    const chunk = paths.slice(i, i + PAGE_SIZE);
    const { data, error } = await client.storage.from(BUCKET).remove(chunk);
    if (error) throw error;
    if ((data ?? []).length !== chunk.length) {
      throw new Error(`Storage removed ${(data ?? []).length} of ${chunk.length} objects under ${prefix}`);
    }
  }
}

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
    await removeObjectsUnder(client, `${userId}/${courseId}`);
  }
}
