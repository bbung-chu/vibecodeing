import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

type LocalEnv = { url: string; anonKey: string };

let cached: LocalEnv | undefined;

/** Env vars win; otherwise read the running local stack via `supabase status`. */
function loadEnv(): LocalEnv {
  if (cached) return cached;
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    const out = execSync("npx supabase status -o env", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const parsed: Record<string, string> = {};
    for (const line of out.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
      if (m) parsed[m[1]] = m[2];
    }
    url ??= parsed.API_URL;
    anonKey ??= parsed.ANON_KEY;
    serviceKey ??= parsed.SERVICE_ROLE_KEY;
  }
  if (!url || !anonKey || !serviceKey) {
    throw new Error("Local Supabase is not running (npx supabase start)");
  }
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
