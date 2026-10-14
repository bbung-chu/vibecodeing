import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadSupabaseEnv } from "../scripts/supabase-env";
import { kstDateKey } from "../src/lib/domain/dday";
import { E2E_PASSWORD, login, uniqueEmail, gotoReady, reloadReady } from "./helpers";

const DAY_MS = 86_400_000;
const FIXTURE_NAME = "운영체제 1주차.pdf";

test("main flow: semester, course, file, midterm, schedule, home, delete", async ({ page }) => {
  test.setTimeout(180_000);
  const email = uniqueEmail("flow");
  await login(page, email);

  // The user's own (anon-key) client: used only to check the storage object is really gone.
  const { url, anonKey } = loadSupabaseEnv();
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: auth, error: signInError } = await client.auth.signInWithPassword({ email, password: E2E_PASSWORD });
  if (signInError) throw signInError;
  const userId = auth.user.id;

  // 1. semester + course
  await gotoReady(page, "/timetable");
  await page.getByLabel("학년").selectOption("3");
  await page.getByLabel("학기", { exact: true }).selectOption("2");
  await page.getByRole("button", { name: "학기 추가" }).click();
  await page.getByRole("button", { name: "강의 추가" }).click();
  await page.getByLabel("강의 이름").fill("운영체제");
  const slot = page.getByTestId("slot-row").first();
  await slot.getByLabel("요일").selectOption({ label: "화" });
  await slot.getByLabel("시작 시간").fill("13:00");
  await slot.getByLabel("끝 시간").fill("14:30");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByTestId("day-화").getByTestId("course-block")).toHaveCount(1);

  // 2. folder in the materials tree
  await gotoReady(page, "/materials");
  const tree = page.getByRole("list", { name: "강의 목록" });
  await expect(tree.getByText("3학년")).toBeVisible();
  await tree.getByRole("link", { name: "운영체제" }).click();
  await expect(page).toHaveURL(/\/materials\?course=/);
  const courseId = new URL(page.url()).searchParams.get("course")!;

  // 3. upload a file
  await page.getByTestId("file-input").setInputFiles({
    name: FIXTURE_NAME,
    mimeType: "application/pdf",
    buffer: readFileSync(path.join(__dirname, "fixtures", FIXTURE_NAME)),
  });
  const rows = page.getByTestId("file-row");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(FIXTURE_NAME);
  const stored = await client.storage.from("materials").list(`${userId}/${courseId}`);
  expect(stored.error).toBeNull();
  expect(stored.data).toHaveLength(1);

  // 4. midterm, 3 days from now (KST) so the home screen's 30-day window shows it
  const examDay = kstDateKey(new Date(Date.now() + 3 * DAY_MS));
  await gotoReady(page, `/courses/${courseId}`);
  const midterm = page.getByTestId("exam-midterm");
  const field = midterm.getByLabel("중간고사 일시");
  const save = midterm.getByRole("button", { name: "저장" });
  await expect(field).toHaveValue("");
  await field.fill(`${examDay}T10:00`);
  await expect(save).toBeEnabled();
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), save.click()]);
  await reloadReady(page);
  await expect(field).toHaveValue(`${examDay}T10:00`);

  // 5. shown on 일정 and 홈
  await gotoReady(page, "/schedule?view=list");
  await expect(page.getByTestId("event-row").filter({ hasText: "운영체제 중간고사" })).toHaveCount(1);
  await gotoReady(page, "/");
  const home = page.getByRole("region", { name: "다가오는 일정" }).getByTestId("home-event");
  await expect(home.filter({ hasText: "운영체제 중간고사" })).toHaveCount(1);

  // 6. delete the course behind the confirm dialog
  await gotoReady(page, `/courses/${courseId}`);
  await page.getByRole("button", { name: "강의 삭제" }).click();
  await expect(page.getByText("이 강의의 일정과 파일이 모두 지워져요. 삭제할까요?")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "삭제" }).click();
  await expect(page).toHaveURL(/\/timetable$/);

  // 7. folder, event and file are gone
  await gotoReady(page, "/materials");
  await expect(page.getByRole("list", { name: "강의 목록" }).getByRole("link", { name: "운영체제" })).toHaveCount(0);
  await gotoReady(page, `/materials?course=${courseId}`);
  await expect(page.getByText("왼쪽에서 강의를 골라 주세요")).toBeVisible();
  await expect(rows).toHaveCount(0);
  await gotoReady(page, "/schedule?view=list");
  await expect(page.getByTestId("event-row").filter({ hasText: "운영체제 중간고사" })).toHaveCount(0);
  await gotoReady(page, "/");
  await expect(home.filter({ hasText: "운영체제 중간고사" })).toHaveCount(0);

  // rows are gone for the user, and so is the storage object
  const { data: fileRows, error: rowsError } = await client.from("files").select("id").eq("course_id", courseId);
  expect(rowsError).toBeNull();
  expect(fileRows).toEqual([]);
  const after = await client.storage.from("materials").list(`${userId}/${courseId}`);
  expect(after.error).toBeNull();
  expect(after.data).toEqual([]);
});
