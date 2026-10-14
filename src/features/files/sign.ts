import type { SupabaseClient } from "@supabase/supabase-js";
import { isPreviewMime } from "@/lib/domain/files";

export type SignableFile = { name: string; storage_path: string; mime_type: string | null };

/**
 * 60-second signed URL. Preview (inline) is signed only for stored pdf/png/jpeg types;
 * anything else is signed as a download under the original (Korean) file name.
 */
export async function signFileUrl(
  client: SupabaseClient,
  file: SignableFile,
  mode: "preview" | "download",
): Promise<string> {
  const inline = mode === "preview" && isPreviewMime(file.mime_type);
  const { data, error } = await client.storage
    .from("materials")
    .createSignedUrl(file.storage_path, 60, inline ? undefined : { download: file.name });
  if (error || !data) throw error ?? new Error("Could not sign URL");
  return data.signedUrl;
}
