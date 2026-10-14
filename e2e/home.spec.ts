import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadSupabaseEnv } from "../scripts/supabase-env";
import { kstDateKey, kstWeekday } from "../src/lib/domain/dday";
import { E2E_PASSWORD, login, uniqueEmail } from "./helpers";

const DAY_MS = 86_400_000;

/** The next Monday after the real current KST date, at 09:00 KST (00:00Z). */
function nextMonday(): Date {
  const now = new Date();
  const ahead = 8 - kstWeekday(now); // Mon -> 7, Sun -> 1
  const key = kstDateKey(new Date(now.getTime() + ahead * DAY_MS));
  return new Date(`${key}T00:00:00Z`);
}

/** ISO UTC for `monday + days` at the given UTC time of day. */
const at = (monday: Date, days: number, time: string) =>
  `${new Date(monday.getTime() + days * DAY_MS).toISOString().slice(0, 10)}T${time}Z`;

async function seed(email: string, monday: Date) {
  const { url, anonKey } = loadSupabaseEnv();
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: E2E_PASSWORD });
  if (signInError) throw signInError;
  const { data: sem, error: semError } = await client.from("semesters").insert({ year: 2, term: 1 }).select("id").single();
  if (semError) throw semError;
  const { data: course, error: courseError } = await client
    .from("courses")
    .insert({ semester_id: sem.id, name: "운영체제", color: "#60a5fa", room: "공학관 301" })
    .select("id")
    .single();
  if (courseError) throw courseError;
  const { error: slotError } = await client
    .from("course_slots")
    .insert({ course_id: course.id, day_of_week: 1, start_time: "10:30", end_time: "12:00" });
  if (slotError) throw slotError;
  const { error: eventError } = await client.from("events").insert([
    { course_id: course.id, kind: "midterm", title: "운영체제 중간고사", starts_at: at(monday, 1, "01:00:00") },
    { kind: "contest", title: "캡스톤 공모전", starts_at: at(monday, 4, "03:00:00") },
    { kind: "personal", title: "어제 일정", starts_at: at(monday, -1, "03:00:00") },
  ]);
  if (eventError) throw eventError;
}

test("home: today's classes and upcoming events", async ({ page }) => {
  test.setTimeout(120_000);
  const monday = nextMonday();
  await page.clock.setFixedTime(monday);
  const email = uniqueEmail("home");
  await login(page, email);
  await seed(email, monday);
  await page.goto("/");

  const classes = page.getByRole("region", { name: "오늘 수업" });
  await expect(classes).toContainText("운영체제");
  await expect(classes).toContainText("10:30–12:00");
  await expect(classes).toContainText("공학관 301");

  const upcoming = page.getByRole("region", { name: "다가오는 일정" });
  const rows = upcoming.getByTestId("home-event");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("운영체제 중간고사");
  await expect(rows.nth(0)).toContainText("D-1");
  await expect(rows.nth(1)).toContainText("캡스톤 공모전");
  await expect(upcoming).not.toContainText("어제 일정");
});

test("home: empty states", async ({ page }) => {
  await page.clock.setFixedTime(nextMonday());
  await login(page, uniqueEmail("home-empty"));
  await expect(page.getByText("오늘은 수업이 없어요")).toBeVisible();
  await expect(page.getByText("다가오는 일정이 없어요")).toBeVisible();
});
