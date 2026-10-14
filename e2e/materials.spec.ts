import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { login, uniqueEmail, gotoReady, reloadReady } from "./helpers";

const FIXTURE_NAME = "운영체제 1주차.pdf";
// Passed as an in-memory payload so the Korean name survives any locale of the test runner.
const fixture = () => ({
  name: FIXTURE_NAME,
  mimeType: "application/pdf",
  buffer: readFileSync(path.join(__dirname, "fixtures", FIXTURE_NAME)),
});

test("materials: upload, preview, download, rename, delete", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await login(page, uniqueEmail("mat"));
  await gotoReady(page, "/timetable");
  await page.getByLabel("학년").selectOption("2");
  await page.getByLabel("학기", { exact: true }).selectOption("1");
  await page.getByRole("button", { name: "학기 추가" }).click();
  await page.getByRole("button", { name: "강의 추가" }).click();
  await page.getByLabel("강의 이름").fill("운영체제");
  const slot = page.getByTestId("slot-row").first();
  await slot.getByLabel("요일").selectOption({ label: "월" });
  await slot.getByLabel("시작 시간").fill("10:30");
  await slot.getByLabel("끝 시간").fill("12:00");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByTestId("course-block").first()).toBeVisible();

  await gotoReady(page, "/materials");
  await expect(page.getByText("왼쪽에서 강의를 골라 주세요")).toBeVisible();
  const tree = page.getByRole("list", { name: "강의 목록" });
  await expect(tree.getByText("2학년")).toBeVisible();
  await expect(tree.getByText("1학기")).toBeVisible();
  await tree.getByRole("link", { name: "운영체제" }).click();
  await expect(page).toHaveURL(/\/materials\?course=/);
  await expect(page.getByText("아직 올린 파일이 없어요")).toBeVisible();

  // an unknown course id shows the empty selection
  const url = page.url();
  await gotoReady(page, "/materials?course=00000000-0000-4000-8000-000000000000");
  await expect(page.getByText("왼쪽에서 강의를 골라 주세요")).toBeVisible();
  await gotoReady(page, url);

  // rejected client-side
  const input = page.getByTestId("file-input");
  const big = testInfo.outputPath("big.pdf");
  writeFileSync(big, Buffer.alloc(51 * 1024 * 1024)); // generated here, never committed
  await input.setInputFiles(big);
  await expect(page.getByTestId("file-error")).toHaveText("파일은 50MB까지 올릴 수 있어요");
  await input.setInputFiles({ name: "a.exe", mimeType: "application/octet-stream", buffer: Buffer.from("x") });
  await expect(page.getByTestId("file-error")).toHaveText("올릴 수 없는 파일 형식이에요");

  // same file twice: both kept
  const rows = page.getByTestId("file-row");
  await input.setInputFiles(fixture());
  await expect(rows).toHaveCount(1);
  await input.setInputFiles(fixture());
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("운영체제 1주차.pdf");
  await expect(rows.nth(1)).toContainText("운영체제 1주차.pdf");
  await expect(rows.first()).toContainText(/\d+\.\dKB/);
  await expect(rows.first()).toContainText(/\d{4}\.\d{2}\.\d{2}/);

  // preview opens the signed URL in a new tab
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    rows.first().getByRole("button", { name: "미리보기" }).click(),
  ]);
  await popup.waitForURL(/\/storage\/v1\/object\/sign\/materials\//);
  const head = await page.request.get(popup.url());
  expect(head.headers()["content-type"]).toContain("application/pdf");
  await popup.close();

  // download keeps the Korean name
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    rows.first().getByRole("button", { name: "다운로드" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("운영체제 1주차.pdf");

  // rename: allowed extension only
  await rows.first().getByRole("button", { name: "이름 바꾸기" }).click();
  await page.getByLabel("새 파일 이름").fill("bad.exe");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByTestId("file-error")).toHaveText("올릴 수 없는 파일 형식이에요");
  await page.getByLabel("새 파일 이름").fill("운영체제 요약.pdf");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByTestId("file-row").filter({ hasText: "운영체제 요약.pdf" })).toHaveCount(1);

  // delete
  await rows.filter({ hasText: "운영체제 요약.pdf" }).getByRole("button", { name: "삭제" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "삭제" }).click();
  await expect(rows).toHaveCount(1);
  await reloadReady(page);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("운영체제 1주차.pdf");
});
