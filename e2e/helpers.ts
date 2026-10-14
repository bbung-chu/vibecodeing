import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadSupabaseEnv } from "../scripts/supabase-env";

/** Test-only password for users created by E2E helpers. Never used outside E2E. */
export const E2E_PASSWORD = "e2e-only-password-not-a-secret";

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${randomUUID()}@example.com`;
}

/** Creates the user (admin API) if needed, then signs in through /auth/test-login. */
export async function login(page: Page, email: string): Promise<void> {
  const { url, serviceKey } = loadSupabaseEnv();
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { error } = await admin.auth.admin.createUser({
    email,
    password: E2E_PASSWORD,
    email_confirm: true,
  });
  if (error && !/already|registered/i.test(error.message)) throw error;
  const res = await page.request.post("/auth/test-login", {
    data: { email, password: E2E_PASSWORD },
  });
  if (!res.ok()) throw new Error(`test-login failed: ${res.status()}`);
  await page.goto("/");
}
