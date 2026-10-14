import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadSupabaseEnv } from "../../scripts/supabase-env";

type LocalEnv = { url: string; anonKey: string };

let cached: LocalEnv | undefined;

function loadEnv(): LocalEnv {
  if (cached) return cached;
  const { url, anonKey, serviceKey } = loadSupabaseEnv();
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
  cached = { url, anonKey };
  return cached;
}

export function adminClient(): SupabaseClient {
  loadEnv();
  return createAdminClient();
}

export function anonClient(): SupabaseClient {
  const { url, anonKey } = loadEnv();
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

export async function createTestUser(
  email: string,
): Promise<{ client: SupabaseClient; userId: string }> {
  const { url, anonKey } = loadEnv();
  const password = randomUUID();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { client, userId: data.user.id };
}

export async function deleteTestUser(userId: string): Promise<void> {
  await adminClient().auth.admin.deleteUser(userId);
}
