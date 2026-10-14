import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ALLOWED_MIME_TYPES } from "@/lib/domain/files";
import { removeObjectsUnder } from "@/lib/supabase/storage";
import { adminClient, createTestUser, deleteTestUser } from "./helpers";

const run = randomUUID().slice(0, 8);
const BUCKET = "materials";

let user: { client: SupabaseClient; userId: string };
let other: { client: SupabaseClient; userId: string };
let courseId: string;
let otherCourseId: string;

async function makeCourse(client: SupabaseClient): Promise<string> {
  const { data: sem, error: semError } = await client.from("semesters").insert({ year: 1, term: 1 }).select("id").single();
  expect(semError).toBeNull();
  const { data: course, error } = await client
    .from("courses")
    .insert({ semester_id: sem!.id, name: "OS", color: "#ef4444" })
    .select("id")
    .single();
  expect(error).toBeNull();
  return course!.id;
}

const upload = (path: string, contentType = "application/pdf") =>
  user.client.storage.from(BUCKET).upload(path, new Blob(["%PDF-1.4"], { type: contentType }), { contentType });

beforeAll(async () => {
  user = await createTestUser(`sh-${run}@example.test`);
  other = await createTestUser(`sh2-${run}@example.test`);
  courseId = await makeCourse(user.client);
  otherCourseId = await makeCourse(other.client);
});

afterAll(async () => {
  for (const u of [user, other]) {
    if (!u) continue;
    await removeObjectsUnder(adminClient(), u.userId);
    await deleteTestUser(u.userId);
  }
});

describe("materials bucket hardening", () => {
  it("allows an owned course path with an allowed type", async () => {
    expect((await upload(`${user.userId}/${courseId}/${randomUUID()}`)).error).toBeNull();
    expect((await upload(`${user.userId}/${courseId}/${randomUUID()}`, "text/plain")).error).toBeNull();
  });

  it("rejects a disallowed content type", async () => {
    expect((await upload(`${user.userId}/${courseId}/${randomUUID()}`, "text/html")).error).not.toBeNull();
    expect((await upload(`${user.userId}/${courseId}/${randomUUID()}`, "image/svg+xml")).error).not.toBeNull();
  });

  it("only allows the types the app maps extensions to", async () => {
    const { data, error } = await adminClient().storage.getBucket(BUCKET);
    expect(error).toBeNull();
    expect([...(data!.allowed_mime_types ?? [])].sort()).toEqual([...ALLOWED_MIME_TYPES].sort());
  });

  it("rejects paths that are not exactly {uid}/{own course}/{file}", async () => {
    expect((await upload(`${user.userId}/${randomUUID()}`)).error).not.toBeNull();
    expect((await upload(`${user.userId}/${courseId}/a/${randomUUID()}`)).error).not.toBeNull();
    expect((await upload(`${user.userId}/${randomUUID()}/${randomUUID()}`)).error).not.toBeNull();
    expect((await upload(`${user.userId}/${otherCourseId}/${randomUUID()}`)).error).not.toBeNull();
  });

  it("rejects moving an own object outside an owned course folder", async () => {
    const from = `${user.userId}/${courseId}/${randomUUID()}`;
    expect((await upload(from)).error).toBeNull();
    const moved = await user.client.storage.from(BUCKET).move(from, `${user.userId}/${randomUUID()}/${randomUUID()}`);
    expect(moved.error).not.toBeNull();
  });
});
