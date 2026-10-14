import type { SupabaseClient } from "@supabase/supabase-js";
import { removeObjectsUnder } from "@/lib/supabase/storage";

/**
 * Removes every storage object under `{userId}/`, then deletes the signed-in user through the
 * `delete_my_account()` SQL function (rows cascade). Throws on any failure.
 */
export async function deleteAccountWithObjects(client: SupabaseClient, userId: string): Promise<void> {
  await removeObjectsUnder(client, userId);
  const { error } = await client.rpc("delete_my_account");
  if (error) throw error;
}
