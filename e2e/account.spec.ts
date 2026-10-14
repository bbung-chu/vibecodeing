import { expect, test } from "@playwright/test";
import { adminClient, E2E_PASSWORD, gotoReady, login, seedCourse, uniqueEmail, userClient } from "./helpers";
import { createClient } from "@supabase/supabase-js";
import { loadSupabaseEnv } from "../scripts/supabase-env";

test("account deletion removes the user, their rows and their files", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("bye");
  await login(page, email);
  const { client, userId } = await userClient(email);
  const { courseId } = await seedCourse(client);
  const path = `${userId}/${courseId}/${crypto.randomUUID()}`;
  const up = await client.storage.from("materials").upload(path, new Blob(["%PDF"], { type: "application/pdf" }));
  if (up.error) throw up.error;
  const row = await client.from("files").insert({ course_id: courseId, name: "a.pdf", storage_path: path });
  if (row.error) throw row.error;

  await gotoReady(page, "/");
  await page.getByRole("button", { name: "계정 삭제" }).click();
  await expect(page.getByText("계정과 모든 자료가 영구히 지워져요. 삭제할까요?")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "취소" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "계정 삭제" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "삭제" }).click();
  await expect(page).toHaveURL(/\/login$/);

  // the browser session is gone
  await gotoReady(page, "/timetable");
  await expect(page).toHaveURL(/\/login$/);

  // checked without the deleted session: the user, rows and objects are gone
  const admin = adminClient();
  const { data: user } = await admin.auth.admin.getUserById(userId);
  expect(user.user).toBeNull();
  for (const table of ["semesters", "courses", "course_slots", "events", "files"]) {
    const { count, error } = await admin.from(table).select("id", { count: "exact", head: true }).eq("user_id", userId);
    expect(error).toBeNull();
    expect(count, table).toBe(0);
  }
  const { data: objects, error: listError } = await admin.storage.from("materials").list(userId);
  expect(listError).toBeNull();
  expect(objects).toEqual([]);

  // and the old password no longer signs in
  const { url, anonKey } = loadSupabaseEnv();
  const fresh = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signInError } = await fresh.auth.signInWithPassword({ email, password: E2E_PASSWORD });
  expect(signInError).not.toBeNull();
});
