import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerUploadCore } from "@/features/files/register";
import { adminClient, createTestUser, deleteTestUser } from "./helpers";

const run = randomUUID().slice(0, 8);
const BUCKET = "materials";

let user: { client: SupabaseClient; userId: string };
let other: { client: SupabaseClient; userId: string };
let courseId: string;

async function upload(path: string, body = "hello") {
  const { error } = await user.client.storage
    .from(BUCKET)
    .upload(path, new Blob([body], { type: "text/plain" }), { contentType: "text/plain", upsert: false });
  expect(error).toBeNull();
}

async function objectNames(prefix: string): Promise<string[]> {
  const { data, error } = await user.client.storage.from(BUCKET).list(prefix);
  expect(error).toBeNull();
  return (data ?? []).filter((o) => o.id !== null).map((o) => o.name);
}

/** Wraps a client so inserts into `files` fail, as if the DB were down. */
function failingFilesInsert(client: SupabaseClient): SupabaseClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop !== "from") return Reflect.get(target, prop, receiver);
      return (table: string) => {
        const q = target.from(table);
        if (table !== "files") return q;
        return new Proxy(q, {
          get(t, p, r) {
            if (p === "insert") return () => Promise.resolve({ error: { message: "boom" } });
            const v = Reflect.get(t, p, r);
            return typeof v === "function" ? v.bind(t) : v;
          },
        });
      };
    },
  });
}

/** Wraps a client so every query on `files` (insert and the existing-row lookup) errors. */
function failingFilesTable(client: SupabaseClient): SupabaseClient {
  const failed = { data: null, error: { message: "boom" } };
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq"]) chain[m] = () => chain;
  chain.maybeSingle = () => Promise.resolve(failed);
  chain.insert = () => Promise.resolve(failed);
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop !== "from") return Reflect.get(target, prop, receiver);
      return (table: string) => (table === "files" ? chain : target.from(table));
    },
  });
}

beforeAll(async () => {
  user = await createTestUser(`up-${run}@example.test`);
  other = await createTestUser(`up2-${run}@example.test`);
  const { data: sem } = await user.client.from("semesters").insert({ year: 1, term: 1 }).select("id").single();
  const { data: course } = await user.client
    .from("courses")
    .insert({ semester_id: sem!.id, name: "OS", color: "#ef4444" })
    .select("id")
    .single();
  courseId = course!.id;
});

afterAll(async () => {
  await deleteTestUser(user.userId);
  await deleteTestUser(other.userId);
});

describe("registerUploadCore", () => {
  it("registers an uploaded object and stores a row with the real size", async () => {
    const fileId = randomUUID();
    await upload(`${user.userId}/${courseId}/${fileId}`, "hello");
    const res = await registerUploadCore(user.client, user.userId, {
      courseId, fileId, name: "운영체제 1주차.pdf", size: 1, mimeType: "application/pdf",
    });
    expect(res).toEqual({});
    const { data } = await user.client.from("files").select("name, size_bytes, storage_path").eq("course_id", courseId);
    expect(data).toEqual([
      { name: "운영체제 1주차.pdf", size_bytes: 5, storage_path: `${user.userId}/${courseId}/${fileId}` },
    ]);
  });

  it("removes the object when the row insert fails", async () => {
    const fileId = randomUUID();
    await upload(`${user.userId}/${courseId}/${fileId}`);
    const res = await registerUploadCore(failingFilesInsert(user.client), user.userId, {
      courseId, fileId, name: "a.txt", size: 5, mimeType: "text/plain",
    });
    expect(res.error).toBe("업로드에 실패했어요. 다시 시도해 주세요");
    expect(await objectNames(`${user.userId}/${courseId}`)).not.toContain(fileId);
  });

  it("removes the object when the course is not the user's", async () => {
    const { data: sem } = await other.client.from("semesters").insert({ year: 1, term: 1 }).select("id").single();
    const { data: c } = await other.client
      .from("courses").insert({ semester_id: sem!.id, name: "X", color: "#ef4444" }).select("id").single();
    const fileId = randomUUID();
    // The insert policy now refuses this path, so place the object with the service role
    // (as if it predated the policy) to check that registration still cleans it up.
    const placed = await adminClient()
      .storage.from(BUCKET)
      .upload(`${user.userId}/${c!.id}/${fileId}`, new Blob(["hello"], { type: "text/plain" }));
    expect(placed.error).toBeNull();
    const res = await registerUploadCore(user.client, user.userId, {
      courseId: c!.id, fileId, name: "a.txt", size: 5, mimeType: "text/plain",
    });
    expect(res.error).toBeDefined();
    expect(await objectNames(`${user.userId}/${c!.id}`)).toHaveLength(0);
  });

  it("removes the object when validation fails", async () => {
    const fileId = randomUUID();
    await upload(`${user.userId}/${courseId}/${fileId}`);
    const res = await registerUploadCore(user.client, user.userId, {
      courseId, fileId, name: "a.exe", size: 5, mimeType: "text/plain",
    });
    expect(res.error).toBe("올릴 수 없는 파일 형식이에요");
    expect(await objectNames(`${user.userId}/${courseId}`)).not.toContain(fileId);
  });

  it("rejects a missing object and a non-uuid fileId", async () => {
    const missing = await registerUploadCore(user.client, user.userId, {
      courseId, fileId: randomUUID(), name: "a.txt", size: 5, mimeType: "text/plain",
    });
    expect(missing.error).toBeDefined();
    const bad = await registerUploadCore(user.client, user.userId, {
      courseId, fileId: "../x", name: "a.txt", size: 5, mimeType: "text/plain",
    });
    expect(bad.error).toBeDefined();
  });

  it("keeps an already registered object when the same fileId is registered again", async () => {
    const fileId = randomUUID();
    const path = `${user.userId}/${courseId}/${fileId}`;
    await upload(path);
    const input = { courseId, fileId, name: "dup.txt", size: 5, mimeType: "text/plain" };
    expect(await registerUploadCore(user.client, user.userId, input)).toEqual({});
    const again = await registerUploadCore(user.client, user.userId, input);
    expect(again.error).toBeDefined();
    expect(await objectNames(`${user.userId}/${courseId}`)).toContain(fileId);
  });

  it("stores the content type derived from the extension, not the client's", async () => {
    const fileId = randomUUID();
    await upload(`${user.userId}/${courseId}/${fileId}`);
    const res = await registerUploadCore(user.client, user.userId, {
      courseId, fileId, name: "notes.TXT", size: 5, mimeType: "text/html",
    });
    expect(res).toEqual({});
    const { data } = await user.client.from("files").select("mime_type").eq("storage_path", `${user.userId}/${courseId}/${fileId}`).single();
    expect(data?.mime_type).toBe("text/plain");
  });

  it("rejects names over 200 characters and removes the object", async () => {
    const fileId = randomUUID();
    await upload(`${user.userId}/${courseId}/${fileId}`);
    const res = await registerUploadCore(user.client, user.userId, {
      courseId, fileId, name: `${"가".repeat(197)}.txt`, size: 5, mimeType: "text/plain",
    });
    expect(res.error).toBe("파일 이름은 200자 이하로 해 주세요");
    expect(await objectNames(`${user.userId}/${courseId}`)).not.toContain(fileId);
  });

  it("keeps the object when the existing-row lookup itself fails", async () => {
    const fileId = randomUUID();
    await upload(`${user.userId}/${courseId}/${fileId}`);
    const res = await registerUploadCore(failingFilesTable(user.client), user.userId, {
      courseId, fileId, name: "a.txt", size: 5, mimeType: "text/plain",
    });
    expect(res.error).toBe("업로드에 실패했어요. 다시 시도해 주세요");
    expect(await objectNames(`${user.userId}/${courseId}`)).toContain(fileId);
  });
});
