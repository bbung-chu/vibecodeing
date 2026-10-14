"use server";

import { revalidatePath } from "next/cache";
import { validateFile } from "@/lib/domain/files";
import { createServerSupabase, requireUser } from "@/lib/supabase/server";
import { registerUploadCore, type RegisterInput } from "./register";

const BUCKET = "materials";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Called after the browser uploaded the object directly to storage. */
export async function registerUpload(input: RegisterInput): Promise<{ error?: string }> {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  const res = await registerUploadCore(supabase, user.id, input);
  if (!res.error) revalidatePath("/materials");
  return res;
}

async function ownFile(id: string) {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  if (typeof id !== "string" || !UUID.test(id)) return { supabase, user, file: null };
  const { data, error } = await supabase
    .from("files")
    .select("id, name, size_bytes, storage_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return { supabase, user, file: data as { id: string; name: string; size_bytes: number | null; storage_path: string } | null };
}

/** 60-second signed URL. Download mode keeps the original (Korean) file name. */
export async function getFileUrl(id: string, mode: "preview" | "download"): Promise<string> {
  const { supabase, file } = await ownFile(id);
  if (!file) throw new Error("File not found");
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(file.storage_path, 60, mode === "download" ? { download: file.name } : undefined);
  if (error || !data) throw error ?? new Error("Could not sign URL");
  return data.signedUrl;
}

export async function renameFile(id: string, name: string): Promise<{ error?: string }> {
  const { supabase, user, file } = await ownFile(id);
  if (!file) return { error: "파일을 찾을 수 없어요" };
  const trimmed = (name ?? "").trim();
  if (trimmed.length === 0 || trimmed.length > 200) return { error: "파일 이름은 1~200자로 입력해 주세요" };
  const check = validateFile({ name: trimmed, size: Number(file.size_bytes ?? 0) });
  if (!check.ok) return { error: check.reason };
  const { error } = await supabase.from("files").update({ name: trimmed }).eq("id", id).eq("user_id", user.id);
  if (error) return { error: "이름을 바꾸지 못했어요. 다시 시도해 주세요" };
  revalidatePath("/materials");
  return {};
}

/** Removes the storage object first, then the row. */
export async function deleteFile(id: string): Promise<void> {
  const { supabase, user, file } = await ownFile(id);
  if (!file) return;
  const { error: removeError } = await supabase.storage.from(BUCKET).remove([file.storage_path]);
  if (removeError) throw removeError;
  const { error } = await supabase.from("files").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/materials");
}

