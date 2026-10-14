import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signFileUrl } from "@/features/files/sign";
import { removeObjectsUnder } from "@/lib/supabase/storage";
import { adminClient, createTestUser, deleteTestUser } from "./helpers";

const run = randomUUID().slice(0, 8);
let user: { client: SupabaseClient; userId: string };
let path: string;

beforeAll(async () => {
  user = await createTestUser(`url-${run}@example.test`);
  const { data: sem } = await user.client.from("semesters").insert({ year: 1, term: 1 }).select("id").single();
  const { data: course } = await user.client
    .from("courses")
    .insert({ semester_id: sem!.id, name: "OS", color: "#ef4444" })
    .select("id")
    .single();
  path = `${user.userId}/${course!.id}/${randomUUID()}`;
  const up = await user.client.storage.from("materials").upload(path, new Blob(["%PDF"], { type: "application/pdf" }));
  expect(up.error).toBeNull();
});

afterAll(async () => {
  await removeObjectsUnder(adminClient(), user.userId);
  await deleteTestUser(user.userId);
});

const isDownload = (url: string) => new URL(url).searchParams.has("download");

describe("signFileUrl", () => {
  it("signs an inline preview only for pdf, png and jpeg rows", async () => {
    const url = await signFileUrl(user.client, { name: "a.pdf", storage_path: path, mime_type: "application/pdf" }, "preview");
    expect(isDownload(url)).toBe(false);
  });

  it("forces a download for any other stored type, even when preview is asked", async () => {
    for (const mime of ["text/plain", "text/html", null]) {
      const url = await signFileUrl(user.client, { name: "a.pdf", storage_path: path, mime_type: mime }, "preview");
      expect(isDownload(url)).toBe(true);
    }
  });

  it("download mode always signs a download", async () => {
    const url = await signFileUrl(user.client, { name: "a.pdf", storage_path: path, mime_type: "application/pdf" }, "download");
    expect(isDownload(url)).toBe(true);
  });
});
