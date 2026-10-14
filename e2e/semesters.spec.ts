import { expect, test, type Page } from "@playwright/test";
import { login, uniqueEmail } from "./helpers";

async function addSemester(page: Page, year: string, term: string) {
  await page.getByLabel("학년").selectOption(year);
  await page.getByLabel("학기", { exact: true }).selectOption(term);
  await page.getByRole("button", { name: "학기 추가" }).click();
}

test("semester create, duplicate, switch, persist, delete", async ({ page }) => {
  await login(page, uniqueEmail("sem"));
  await expect(page.getByText("아직 학기가 없어요. 학기를 추가해 주세요.")).toBeVisible();

  const picker = page.getByLabel("학기 선택");

  await addSemester(page, "2", "1");
  await expect(picker).toHaveValue(/.+/);
  await expect(picker.locator("option:checked")).toHaveText("2학년 1학기");

  await addSemester(page, "2", "1");
  await expect(page.getByText("이미 있는 학기예요")).toBeVisible();

  await addSemester(page, "2", "2");
  await expect(picker.locator("option")).toHaveText(["2학년 1학기", "2학년 2학기"]);

  await picker.selectOption({ label: "2학년 1학기" });
  await expect(picker.locator("option:checked")).toHaveText("2학년 1학기");
  await page.reload();
  await expect(picker.locator("option:checked")).toHaveText("2학년 1학기");

  await page.getByRole("button", { name: "학기 삭제" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("이 학기의 강의, 일정, 파일이 모두 지워져요. 삭제할까요?")).toBeVisible();
  await dialog.getByRole("button", { name: "취소" }).click();
  await expect(dialog).toBeHidden();
  await expect(picker.locator("option")).toHaveCount(2);

  await page.getByRole("button", { name: "학기 삭제" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "삭제" }).click();
  await expect(picker.locator("option")).toHaveText(["2학년 2학기"]);
  await expect(picker.locator("option:checked")).toHaveText("2학년 2학기");
});
