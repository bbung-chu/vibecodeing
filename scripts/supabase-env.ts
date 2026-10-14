import { execSync } from "node:child_process";

export type SupabaseEnv = { url: string; anonKey: string; serviceKey: string };

/** Env vars win; otherwise read the running local stack via `supabase status -o env`. */
export function loadSupabaseEnv(): SupabaseEnv {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    let out = "";
    try {
      out = execSync("npx supabase status -o env", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      // handled below
    }
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
  return { url, anonKey, serviceKey };
}
