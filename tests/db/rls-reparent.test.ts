import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { removeCourseObjects } from "@/lib/supabase/storage";
import { adminClient, createTestUser, deleteTestUser } from "./helpers";

/**
 * Regression tests: user A must not be able to move their OWN rows or objects
 * under user B (re-parenting, user_id change, storage move/copy/upload).
 */
const run = randomUUID().slice(0, 8);
const BUCKET = "materials";
const bytes = () => new Blob(["hello"], { type: "text/plain" });

type Owned = {
  client: SupabaseClient;
  userId: string;
  semesterId: string;
  courseId: string;
  eventId: string;
  fileRowId: string;
  objectPath: string;
};

let a: Owned;
let b: Owned;

async function seed(prefix: string): Promise<Owned> {
  const { client, userId } = await createTestUser(`${prefix}-${run}@example.test`);
  const { data: sem, error: semError } = await client.from("semesters").insert({ year: 1, term: 1 }).select("id").single();
  expect(semError).toBeNull();
  const { data: course, error: courseError } = await client
    .from("courses")
    .insert({ semester_id: sem!.id, name: "OS", color: "#ef4444" })
    .select("id")
    .single();
  expect(courseError).toBeNull();
  const { data: ev, error: evError } = await client
    .from("events")
    .insert({ course_id: course!.id, kind: "assignment", title: "hw", starts_at: "2026-10-20T05:00:00Z" })
    .select("id")
    .single();
  expect(evError).toBeNull();
  const objectPath = `${userId}/${course!.id}/${randomUUID()}`;
  const up = await client.storage.from(BUCKET).upload(objectPath, bytes(), { contentType: "text/plain" });
  expect(up.error).toBeNull();
  const { data: file, error: fileError } = await client
    .from("files")
    .insert({ course_id: course!.id, name: "a.txt", storage_path: objectPath })
    .select("id")
    .single();
  expect(fileError).toBeNull();
  return {
    client,
    userId,
    semesterId: sem!.id,
    courseId: course!.id,
    eventId: ev!.id,
    fileRowId: file!.id,
    objectPath,
  };
}

async function row(table: string, id: string): Promise<Record<string, unknown>> {
  const { data, error } = await adminClient().from(table).select("*").eq("id", id).single();
  expect(error).toBeNull();
  return data as Record<string, unknown>;
}

async function objectsUnder(prefix: string): Promise<string[]> {
  const { data, error } = await adminClient().storage.from(BUCKET).list(prefix);
  expect(error).toBeNull();
  return (data ?? []).filter((o) => o.id !== null).map((o) => o.name);
}

beforeAll(async () => {
  a = await seed("ra");
  b = await seed("rb");
});

afterAll(async () => {
  for (const u of [a, b]) {
    if (!u) continue;
    await removeCourseObjects(adminClient(), u.userId, [u.courseId]);
    await deleteTestUser(u.userId);
  }
});

describe("A cannot move own data under B", () => {
  it("(a) cannot re-parent own course into B's semester", async () => {
    const { error } = await a.client.from("courses").update({ semester_id: b.semesterId }).eq("id", a.courseId);
    expect(error).not.toBeNull();
    expect((await row("courses", a.courseId)).semester_id).toBe(a.semesterId);
  });

  it("(b) cannot move own event onto B's course", async () => {
    const { error } = await a.client.from("events").update({ course_id: b.courseId }).eq("id", a.eventId);
    expect(error).not.toBeNull();
    expect((await row("events", a.eventId)).course_id).toBe(a.courseId);
  });

  it.each([
    ["semesters", () => a.semesterId],
    ["courses", () => a.courseId],
    ["events", () => a.eventId],
    ["files", () => a.fileRowId],
  ] as const)("(c) cannot change user_id on own %s row to B", async (table, id) => {
    const { error } = await a.client.from(table).update({ user_id: b.userId }).eq("id", id());
    expect(error).not.toBeNull();
    expect((await row(table, id())).user_id).toBe(a.userId);
  });

  it("(d) cannot point a files row at B's course or storage path", async () => {
    const toCourse = await a.client.from("files").update({ course_id: b.courseId }).eq("id", a.fileRowId);
    expect(toCourse.error).not.toBeNull();
    const toPath = await a.client.from("files").update({ storage_path: b.objectPath }).eq("id", a.fileRowId);
    expect(toPath.error).not.toBeNull();
    const inserted = await a.client
      .from("files")
      .insert({ course_id: a.courseId, name: "x.txt", storage_path: `${b.userId}/${b.courseId}/${randomUUID()}` });
    expect(inserted.error).not.toBeNull();
    const after = await row("files", a.fileRowId);
    expect(after.course_id).toBe(a.courseId);
    expect(after.storage_path).toBe(a.objectPath);
  });

  it("(e) cannot move or copy own object into B's folder", async () => {
    const target = `${b.userId}/${b.courseId}/${randomUUID()}`;
    const before = await objectsUnder(`${b.userId}/${b.courseId}`);
    const moved = await a.client.storage.from(BUCKET).move(a.objectPath, target);
    expect(moved.error).not.toBeNull();
    const copied = await a.client.storage.from(BUCKET).copy(a.objectPath, target);
    expect(copied.error).not.toBeNull();
    expect(await objectsUnder(`${b.userId}/${b.courseId}`)).toEqual(before);
    expect(await objectsUnder(`${a.userId}/${a.courseId}`)).toContain(a.objectPath.split("/")[2]);
  });

  it("(f) cannot upload into B's folder", async () => {
    const target = `${b.userId}/${b.courseId}/${randomUUID()}`;
    const { error } = await a.client.storage.from(BUCKET).upload(target, bytes(), { contentType: "text/plain" });
    expect(error).not.toBeNull();
    expect(await objectsUnder(`${b.userId}/${b.courseId}`)).not.toContain(target.split("/")[2]);
  });
});
