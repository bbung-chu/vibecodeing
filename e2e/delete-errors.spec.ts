import { expect, test } from "@playwright/test";
import { gotoReady, interceptServerActions, login, seedCourse, uniqueEmail, userClient } from "./helpers";

const DELETE_FAILED = "삭제하지 못했어요. 다시 시도해 주세요";

test("failed deletes show a Korean error instead of crashing", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("delerr");
  await login(page, email);
  const { client } = await userClient(email);
  const { courseId } = await seedCourse(client);
  const { error } = await client
    .from("events")
    .insert({ course_id: courseId, kind: "assignment", title: "레포트 1", starts_at: "2026-10-30T09:00:00Z" });
  if (error) throw error;

  await gotoReady(page, `/courses/${courseId}`);
  await interceptServerActions(page, "abort");

  // assignment (asks first)
  await page.getByTestId("assignment-row").getByRole("button", { name: "삭제" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "삭제" }).click();
  await expect(page.getByRole("alert").filter({ hasText: DELETE_FAILED })).toBeVisible();
  await expect(page.getByTestId("assignment-row")).toHaveCount(1);

  // course
  await page.getByRole("button", { name: "강의 삭제" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "삭제" }).click();
  await expect(page.getByRole("alert").filter({ hasText: DELETE_FAILED }).last()).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/courses/${courseId}$`));
  await expect(page.getByRole("heading", { name: "운영체제" })).toBeVisible();

  // semester
  await page.getByRole("button", { name: "학기 삭제" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "삭제" }).click();
  await expect(page.getByRole("alert").filter({ hasText: DELETE_FAILED })).toHaveCount(3);
  await expect(page.getByLabel("학기 선택")).toBeVisible();
});
