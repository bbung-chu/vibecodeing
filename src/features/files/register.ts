import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_FILE_BYTES, mimeTypeFor, validateFile } from "@/lib/domain/files";

const BUCKET = "materials";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const UPLOAD_FAILED = "업로드에 실패했어요. 다시 시도해 주세요";
const MAX_NAME_LENGTH = 200;

export type RegisterInput = {
  courseId: string;
  fileId: string;
  name: string;
  size: number;
  /** Ignored: the stored type is derived from the name's extension. */
  mimeType?: string;
};

/**
 * Registers an object the browser already uploaded to `{userId}/{courseId}/{fileId}`.
 * On any failure the object is removed so no orphan is left, unless a row already
 * points at it (a repeated registration must not delete the registered file).
 */
export async function registerUploadCore(
  client: SupabaseClient,
  userId: string,
  input: RegisterInput,
): Promise<{ error?: string }> {
  const { courseId, fileId } = input;
  if (typeof courseId !== "string" || typeof fileId !== "string" || !UUID.test(courseId) || !UUID.test(fileId)) {
    return { error: UPLOAD_FAILED };
  }
  const storagePath = `${userId}/${courseId}/${fileId}`;

  const fail = async (error: string): Promise<{ error: string }> => {
    const { data: existing, error: lookupError } = await client
      .from("files")
      .select("id")
      .eq("storage_path", storagePath)
      .maybeSingle();
    // If we can't tell whether a row points at the object, keep it rather than risk deleting a registered file.
    if (!lookupError && !existing) await client.storage.from(BUCKET).remove([storagePath]);
    return { error };
  };

  const name = typeof input.name === "string" ? input.name : "";
  if (name.trim().length > MAX_NAME_LENGTH) return fail("파일 이름은 200자 이하로 해 주세요");
  const declared = validateFile({ name, size: Number.isFinite(input.size) ? input.size : 0 });
  if (!declared.ok) return fail(declared.reason);

  const { data: course, error: courseError } = await client
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("user_id", userId)
    .maybeSingle();
  if (courseError || !course) return fail(UPLOAD_FAILED);

  const { data: objects, error: listError } = await client.storage
    .from(BUCKET)
    .list(`${userId}/${courseId}`, { search: fileId, limit: 10 });
  const object = (objects ?? []).find((o) => o.name === fileId);
  if (listError || !object) return fail(UPLOAD_FAILED);

  const realSize = Number((object.metadata as { size?: number } | null)?.size);
  if (!Number.isFinite(realSize)) return fail(UPLOAD_FAILED);
  const checked = validateFile({ name, size: realSize });
  if (!checked.ok) return fail(checked.reason);
  if (realSize > MAX_FILE_BYTES) return fail("파일은 50MB까지 올릴 수 있어요");

  const { error: insertError } = await client.from("files").insert({
    course_id: courseId,
    name: name.trim(),
    size_bytes: realSize,
    mime_type: mimeTypeFor(name),
    storage_path: storagePath,
  });
  if (insertError) return fail(UPLOAD_FAILED);
  return {};
}
