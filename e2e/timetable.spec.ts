import { expect, test, type Page } from "@playwright/test";
import { login, uniqueEmail, gotoReady } from "./helpers";

async function addCourse(
  page: Page,
  name: string,
  slots: { day: string; start: string; end: string }[],
) {
  await page.getByRole("button", { name: "강의 추가" }).click();
  await page.getByLabel("강의 이름").fill(name);
  for (let i = 0; i < slots.length; i++) {
    if (i > 0) await page.getByRole("button", { name: "시간 추가" }).click();
    const row = page.getByTestId("slot-row").nth(i);
    await row.getByLabel("요일").selectOption({ label: slots[i].day });
    await row.getByLabel("시작 시간").fill(slots[i].start);
    await row.getByLabel("끝 시간").fill(slots[i].end);
  }
  await page.getByRole("button", { name: "저장", exact: true }).click();
}

test("timetable: add, overlap warning, invalid time, open course", async ({ page }) => {
  await login(page, uniqueEmail("tt"));
  await gotoReady(page, "/timetable");
  await expect(page.getByText("아직 학기가 없어요. 학기를 추가해 주세요.")).toBeVisible();
  await expect(page.getByRole("button", { name: "강의 추가" })).toHaveCount(0);

  await page.getByLabel("학년").selectOption("2");
  await page.getByLabel("학기", { exact: true }).selectOption("1");
  await page.getByRole("button", { name: "학기 추가" }).click();
  await expect(page.getByRole("button", { name: "강의 추가" })).toBeVisible();

  for (const d of ["월", "화", "수", "목", "금"]) {
    await expect(page.getByTestId("timetable").getByText(d, { exact: true })).toBeVisible();
  }
  await expect(page.getByTestId("timetable").getByText("토", { exact: true })).toHaveCount(0);

  await addCourse(page, "운영체제", [
    { day: "월", start: "10:30", end: "12:00" },
    { day: "수", start: "10:30", end: "12:00" },
  ]);
  await expect(page.getByTestId("day-월").getByTestId("course-block")).toHaveCount(1);
  await expect(page.getByTestId("day-수").getByTestId("course-block")).toHaveCount(1);
  await expect(page.getByTestId("timetable").getByText("09:00", { exact: true })).toBeVisible();
  await expect(page.getByTestId("timetable").getByText("17:00", { exact: true })).toBeVisible();
  await expect(page.getByTestId("timetable").getByText("18:00", { exact: true })).toHaveCount(0);

  await addCourse(page, "자료구조", [{ day: "월", start: "11:00", end: "12:30" }]);
  await expect(page.getByText("다른 수업과 시간이 겹쳐요: 운영체제 (월 10:30~12:00)")).toBeVisible();
  await page.getByRole("button", { name: "그래도 저장" }).click();
  await expect(page.getByTestId("day-월").getByTestId("course-block")).toHaveCount(2);

  await addCourse(page, "영어", [{ day: "금", start: "15:00", end: "14:00" }]);
  await expect(page.getByText("시작 시간이 끝 시간보다 빨라야 해요")).toBeVisible();
  await page.getByRole("button", { name: "닫기" }).click();

  await page.getByTestId("day-수").getByTestId("course-block").click();
  await expect(page).toHaveURL(/\/courses\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "운영체제" })).toBeVisible();

  await page.getByRole("button", { name: "강의 삭제" }).click();
  await expect(page.getByText("이 강의의 일정과 파일이 모두 지워져요. 삭제할까요?")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "삭제" }).click();
  await expect(page).toHaveURL(/\/timetable$/);
  await expect(page.getByTestId("day-수").getByTestId("course-block")).toHaveCount(0);
  await expect(page.getByTestId("day-월").getByTestId("course-block")).toHaveCount(1);
});
