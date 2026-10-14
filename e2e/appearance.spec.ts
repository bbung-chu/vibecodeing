import { expect, test } from "@playwright/test";
import { gotoReady } from "./helpers";

test("dark OS setting keeps dark text on a light page", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await gotoReady(page, "/login");
  const colors = await page.evaluate(() => {
    const s = getComputedStyle(document.body);
    return { color: s.color, background: s.backgroundColor };
  });
  expect(colors).toEqual({ color: "rgb(23, 23, 23)", background: "rgb(255, 255, 255)" });
});
