import { expect, test, type Locator, type Page } from "@playwright/test";
import { login, uniqueEmail } from "./helpers";

/** Click a button that fires a server action and wait for that POST to finish. */
async function clickAndSettle(page: Page, button: Locator) {
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), button.click()]);
}

test("course page: exams and assignments", async ({ page }) => {
  test.setTimeout(90_000); // dev server compiles routes on first hit; parallel specs make that slow
  await login(page, uniqueEmail("ev"));
  await page.goto("/timetable");
  await page.getByLabel("학년").selectOption("2");
  await page.getByLabel("학기", { exact: true }).selectOption("1");
  await page.getByRole("button", { name: "학기 추가" }).click();
  await page.getByRole("button", { name: "강의 추가" }).click();
  await page.getByLabel("강의 이름").fill("운영체제");
  const row = page.getByTestId("slot-row").first();
  await row.getByLabel("요일").selectOption({ label: "월" });
  await row.getByLabel("시작 시간").fill("10:30");
  await row.getByLabel("끝 시간").fill("12:00");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByTestId("course-block").first().click();
  await expect(page.getByRole("heading", { name: "운영체제" })).toBeVisible();

  const midterm = page.getByTestId("exam-midterm");
  await midterm.getByLabel("중간고사 일시").fill("2026-10-20T10:00");
  await clickAndSettle(page, midterm.getByRole("button", { name: "저장" }));
  await page.reload();
  await expect(page.getByTestId("exam-midterm").getByLabel("중간고사 일시")).toHaveValue("2026-10-20T10:00");

  // change it: still a single midterm
  await page.getByTestId("exam-midterm").getByLabel("중간고사 일시").fill("2026-10-21T14:30");
  await clickAndSettle(page, page.getByTestId("exam-midterm").getByRole("button", { name: "저장" }));
  await page.reload();
  await expect(page.getByTestId("exam-midterm").getByLabel("중간고사 일시")).toHaveValue("2026-10-21T14:30");

  // clear it
  await clickAndSettle(page, page.getByTestId("exam-midterm").getByRole("button", { name: "지우기" }));
  await page.reload();
  await expect(page.getByTestId("exam-midterm").getByLabel("중간고사 일시")).toHaveValue("");

  // final exam is independent
  await page.getByTestId("exam-final").getByLabel("기말고사 일시").fill("2026-12-15T09:00");
  await clickAndSettle(page, page.getByTestId("exam-final").getByRole("button", { name: "저장" }));
  await page.reload();
  await expect(page.getByTestId("exam-final").getByLabel("기말고사 일시")).toHaveValue("2026-12-15T09:00");

  // assignments, listed by deadline
  const add = async (title: string, at: string) => {
    await page.getByLabel("과제 이름").fill(title);
    await page.getByLabel("마감 일시").fill(at);
    await page.getByRole("button", { name: "과제 추가" }).click();
    await expect(page.getByTestId("assignment-row").filter({ hasText: title })).toBeVisible();
  };
  await add("레포트 2", "2026-11-10T23:59");
  await add("레포트 1", "2026-10-30T18:00");
  const rows = page.getByTestId("assignment-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("레포트 1");
  await expect(rows.nth(1)).toContainText("레포트 2");
  await expect(rows.nth(0)).toContainText("2026-10-30 18:00");

  // blank title rejected
  await page.getByLabel("마감 일시").fill("2026-11-01T10:00");
  await page.getByRole("button", { name: "과제 추가" }).click();
  await expect(page.getByText("과제 이름을 입력해 주세요")).toBeVisible();

  await rows.nth(0).getByRole("button", { name: "삭제" }).click();
  await expect(rows).toHaveCount(1);
  await page.reload();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("레포트 2");
});
