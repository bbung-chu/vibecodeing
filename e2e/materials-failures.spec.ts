import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { adminClient, gotoReady, interceptServerActions, login, seedCourse, uniqueEmail, userClient } from "./helpers";

const FIXTURE_NAME = "운영체제 1주차.pdf";
const fixture = () => ({
  name: FIXTURE_NAME,
  mimeType: "application/pdf",
  buffer: readFileSync(path.join(__dirname, "fixtures", FIXTURE_NAME)),
});

test("preview opens its tab on click and closes it on failure; failed registration leaves no object", async ({ page }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("matfail");
  await login(page, email);
  const { client, userId } = await userClient(email);
  const { courseId } = await seedCourse(client);
  const listObjects = async () => {
    const { data, error } = await adminClient().storage.from("materials").list(`${userId}/${courseId}`);
    if (error) throw error;
    return data ?? [];
  };

  await gotoReady(page, `/materials?course=${courseId}`);
  const rows = page.getByTestId("file-row");
  await page.getByTestId("file-input").setInputFiles(fixture());
  await expect(rows).toHaveCount(1);
  await expect.poll(async () => (await listObjects()).map((o) => o.metadata?.mimetype)).toEqual(["application/pdf"]);

  // The tab opens synchronously in the click (popup blockers allow it), even while the URL is slow.
  await interceptServerActions(page, "delay", 3_000);
  const popupPromise = page.waitForEvent("popup", { timeout: 1_500 });
  await rows.first().getByRole("button", { name: "미리보기" }).click();
  const popup = await popupPromise;
  await popup.waitForURL(/\/storage\/v1\/object\/sign\/materials\//);
  expect(await popup.evaluate(() => window.opener)).toBeNull();
  await popup.close();
  await page.unrouteAll({ behavior: "wait" });

  // If signing fails, the blank tab is closed and the error shown.
  await interceptServerActions(page, "abort");
  const failedPopup = page.waitForEvent("popup");
  await rows.first().getByRole("button", { name: "미리보기" }).click();
  const blank = await failedPopup;
  await blank.waitForEvent("close");
  await expect(page.getByTestId("file-error")).toHaveText("파일을 열지 못했어요. 다시 시도해 주세요");

  // Upload succeeds in storage but registration fails: the object is removed again.
  await page.getByTestId("file-input").setInputFiles(fixture());
  await expect(page.getByText("업로드에 실패했어요. 다시 시도해 주세요")).toBeVisible();
  await expect.poll(async () => (await listObjects()).length).toBe(1);
  await expect(rows).toHaveCount(1);
});
