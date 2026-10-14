import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadSupabaseEnv } from "../scripts/supabase-env";

/** Test-only password for users created by E2E helpers. Never used outside E2E. */
export const E2E_PASSWORD = "e2e-only-password-not-a-secret";

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${randomUUID()}@example.com`;
}

/** Waits until React has hydrated (HydrationMarker), so client handlers are attached. */
export async function waitForHydration(page: Page): Promise<void> {
  await page.locator('html[data-hydrated="true"]').waitFor({ state: "attached" });
}

export async function gotoReady(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await waitForHydration(page);
}

export async function reloadReady(page: Page): Promise<void> {
  await page.reload();
  await waitForHydration(page);
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
  await gotoReady(page, "/");
}

/** Test-only service-role client, for checks that must not depend on the user's session. */
export function adminClient(): SupabaseClient {
  const { url, serviceKey } = loadSupabaseEnv();
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/** The E2E user's own (anon-key, RLS-bound) client. */
export async function userClient(email: string): Promise<{ client: SupabaseClient; userId: string }> {
  const { url, anonKey } = loadSupabaseEnv();
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: E2E_PASSWORD });
  if (error) throw error;
  return { client, userId: data.user.id };
}

/** Seeds one semester and one course (Mon 10:30–12:00) through the user's own client. */
export async function seedCourse(
  client: SupabaseClient,
  name = "운영체제",
): Promise<{ semesterId: string; courseId: string }> {
  const { data: sem, error: semError } = await client.from("semesters").insert({ year: 2, term: 1 }).select("id").single();
  if (semError) throw semError;
  const { data: course, error } = await client
    .from("courses")
    .insert({ semester_id: sem.id, name, color: "#60a5fa" })
    .select("id")
    .single();
  if (error) throw error;
  const { error: slotError } = await client
    .from("course_slots")
    .insert({ course_id: course.id, day_of_week: 1, start_time: "10:30", end_time: "12:00" });
  if (slotError) throw slotError;
  return { semesterId: sem.id, courseId: course.id };
}

/**
 * Makes the page's server-action requests fail: "abort" drops them (network error),
 * "delay" holds each one for `ms` before letting it through.
 */
export async function interceptServerActions(page: Page, mode: "abort" | "delay", ms = 2_000): Promise<void> {
  await page.route("**/*", async (route) => {
    const req = route.request();
    if (req.method() !== "POST" || !req.headers()["next-action"]) return route.fallback();
    if (mode === "abort") return route.abort();
    await new Promise((r) => setTimeout(r, ms));
    return route.fallback();
  });
}
