import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadSupabaseEnv } from "../scripts/supabase-env";
import { E2E_PASSWORD, login, uniqueEmail, gotoReady, reloadReady } from "./helpers";

const COURSE_COLOR = "#60a5fa"; // rgb(96, 165, 250)
const DAY_MS = 86_400_000;

/** Seeds a semester, a course with a 2026-10-20 10:00 KST midterm, and two upcoming personal events as the user. */
async function seed(email: string) {
  const { url, anonKey } = loadSupabaseEnv();
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: E2E_PASSWORD });
  if (signInError) throw signInError;
  const { data: sem, error: semError } = await client.from("semesters").insert({ year: 2, term: 1 }).select("id").single();
  if (semError) throw semError;
  const { data: course, error: courseError } = await client
    .from("courses")
    .insert({ semester_id: sem.id, name: "운영체제", color: COURSE_COLOR })
    .select("id")
    .single();
  if (courseError) throw courseError;
  const { error: examError } = await client
    .from("events")
    .insert({ course_id: course.id, kind: "midterm", title: "운영체제 중간고사", starts_at: "2026-10-20T01:00:00Z" });
  if (examError) throw examError;

  // Relative to the real clock so the list view assertions hold on any day (KST date at 12:00).
  const inDays = (n: number) => {
    const key = new Date(Date.now() + 9 * 3_600_000 + n * DAY_MS).toISOString().slice(0, 10);
    return `${key}T03:00:00Z`;
  };
  const { error: personalError } = await client.from("events").insert([
    { kind: "personal", title: "나중 개인 일정", starts_at: inDays(5) },
    { kind: "contest", title: "먼저 공모전", starts_at: inDays(2) },
    { kind: "personal", title: "지난 일정", starts_at: inDays(-3) },
  ]);
  if (personalError) throw personalError;
  return { courseId: course.id as string };
}

test("schedule: month calendar and list", async ({ page }) => {
  test.setTimeout(120_000);
  const email = uniqueEmail("sched");
  await login(page, email);
  const { courseId } = await seed(email);

  // course event on 20 October, in the course color, linking to the course page
  await gotoReady(page, "/schedule?view=month&month=2026-10");
  await expect(page.getByRole("heading", { name: "2026년 10월" })).toBeVisible();
  const exam = page.getByTestId("day-2026-10-20").getByRole("link", { name: /운영체제 중간고사/ });
  await expect(exam).toBeVisible();
  await expect(exam).toHaveAttribute("href", `/courses/${courseId}`);
  await expect(exam).toHaveCSS("background-color", "rgb(96, 165, 250)");
  await exam.click();
  await expect(page.getByRole("heading", { name: "운영체제" })).toBeVisible();

  // invalid month falls back to the current month (a heading with 년/월 is shown)
  await gotoReady(page, "/schedule?month=2026-99");
  await expect(page.getByRole("heading", { name: /^\d{4}년 \d{1,2}월$/ })).toBeVisible();

  // month navigation
  await gotoReady(page, "/schedule?view=month&month=2026-10");
  await page.getByRole("link", { name: "다음 달" }).click();
  await expect(page.getByRole("heading", { name: "2026년 11월" })).toBeVisible();

  // blank title is rejected in Korean
  await page.getByRole("button", { name: "일정 추가" }).click();
  await page.getByLabel("날짜와 시간").fill("2026-11-03T10:00");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText("일정 이름을 입력해 주세요")).toBeVisible();

  // add a 공모전 on 3 November
  await page.getByLabel("종류").selectOption({ label: "공모전" });
  await page.getByLabel("이름").fill("캡스톤 공모전");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  const cell = page.getByTestId("day-2026-11-03");
  await expect(cell.getByRole("button", { name: /캡스톤 공모전/ })).toBeVisible();
  await reloadReady(page);
  await expect(cell.getByRole("button", { name: /캡스톤 공모전/ })).toBeVisible();

  // edit it
  await cell.getByRole("button", { name: /캡스톤 공모전/ }).click();
  await expect(page.getByLabel("이름")).toHaveValue("캡스톤 공모전");
  await page.getByLabel("이름").fill("캡스톤 공모전 최종");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(cell.getByRole("button", { name: /캡스톤 공모전 최종/ })).toBeVisible();

  // cancel closes the form without changes
  await cell.getByRole("button", { name: /캡스톤 공모전 최종/ }).click();
  await page.getByRole("button", { name: "취소" }).click();
  await expect(page.getByLabel("이름")).toHaveCount(0);

  // delete it behind a confirm dialog
  await cell.getByRole("button", { name: /캡스톤 공모전 최종/ }).click();
  await page.getByRole("region", { name: "일정 편집" }).getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "이 일정을 삭제할까요?" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "삭제" }).click();
  await expect(cell.getByRole("button", { name: /캡스톤 공모전/ })).toHaveCount(0);

  // list view: upcoming only, ascending, with D-day labels
  await page.getByRole("link", { name: "목록" }).click();
  const rows = page.getByTestId("event-row");
  const first = rows.filter({ hasText: "먼저 공모전" });
  const later = rows.filter({ hasText: "나중 개인 일정" });
  await expect(first).toContainText("D-2");
  await expect(later).toContainText("D-5");
  await expect(rows.filter({ hasText: "지난 일정" })).toHaveCount(0);
  const titles = await rows.allInnerTexts();
  expect(titles.findIndex((t) => t.includes("먼저 공모전"))).toBeLessThan(
    titles.findIndex((t) => t.includes("나중 개인 일정")),
  );

  // toggle back to the calendar
  await page.getByRole("link", { name: "달력" }).click();
  await expect(page.getByRole("heading", { name: /^\d{4}년 \d{1,2}월$/ })).toBeVisible();
});
