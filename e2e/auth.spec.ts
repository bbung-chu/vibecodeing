import { expect, test } from "@playwright/test";
import { login, uniqueEmail } from "./helpers";

test("signed-out visit to /timetable lands on /login", async ({ page }) => {
  await page.goto("/timetable");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "구글로 계속하기" })).toBeVisible();
});

test("signed-in user sees sidebar and can log out", async ({ page }) => {
  await login(page, uniqueEmail("auth"));
  await expect(page).toHaveURL("/");
  const nav = page.getByRole("navigation");
  for (const name of ["홈", "시간표", "자료", "일정"]) {
    await expect(nav.getByRole("link", { name })).toBeVisible();
  }
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/timetable");
  await expect(page).toHaveURL(/\/login$/);
});
