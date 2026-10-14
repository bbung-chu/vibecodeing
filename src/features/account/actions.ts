"use server";

import { redirect } from "next/navigation";
import { createServerSupabase, requireUser } from "@/lib/supabase/server";
import { deleteAccountWithObjects } from "./delete";

/**
 * Deletes the signed-in user's files, then the user (rows cascade) via delete_my_account(),
 * then signs out. Uses only the user's own client: no service-role key in the app.
 */
export async function deleteAccount(): Promise<{ error?: string }> {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  try {
    await deleteAccountWithObjects(supabase, user.id);
  } catch {
    return { error: "계정을 삭제하지 못했어요. 다시 시도해 주세요" };
  }
  // The user no longer exists, so this mainly clears the auth cookies.
  await supabase.auth.signOut();
  redirect("/login");
}
