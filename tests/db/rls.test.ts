import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { removeCourseObjects } from "@/lib/supabase/storage";
import { adminClient, anonClient, createTestUser, deleteTestUser } from "./helpers";

const run = randomUUID().slice(0, 8);
const bytes = () => new Blob(["hello"], { type: "text/plain" });

let a: { client: SupabaseClient; userId: string };
let b: { client: SupabaseClient; userId: string };
let semesterId: string;
let courseId: string;
let otherCourseId: string;
let eventId: string;
let fileId: string;
const fileObject = () => `${a.userId}/${courseId}/${fileId}`;

async function insertOk<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  expect(error).toBeNull();
  return data as NonNullable<T>;
}

beforeAll(async () => {
  a = await createTestUser(`a-${run}@example.test`);
  b = await createTestUser(`b-${run}@example.test`);

  semesterId = (
    await insertOk(a.client.from("semesters").insert({ year: 1, term: 1 }).select("id").single())
  ).id;
  courseId = (
    await insertOk(
      a.client.from("courses").insert({ semester_id: semesterId, name: "OS", color: "#f00" }).select("id").single(),
    )
  ).id;
  otherCourseId = (
    await insertOk(
      a.client.from("courses").insert({ semester_id: semesterId, name: "DB", color: "#0f0" }).select("id").single(),
    )
  ).id;
  eventId = (
    await insertOk(
      a.client
        .from("events")
        .insert({ course_id: courseId, kind: "midterm", title: "중간고사", starts_at: "2026-10-20T05:00:00Z" })
        .select("id")
        .single(),
    )
  ).id;
  fileId = randomUUID();
  await insertOk(
    a.client
      .from("files")
      .insert({ id: fileId, course_id: courseId, name: "운영체제 1주차.pdf", storage_path: fileObject() })
      .select("id")
      .single(),
  );
  const { error } = await a.client.storage.from("materials").upload(fileObject(), bytes());
  expect(error).toBeNull();
});

afterAll(async () => {
  const admin = adminClient();
  for (const u of [a, b]) {
    if (!u) continue;
    const ids = (await admin.from("courses").select("id").eq("user_id", u.userId)).data ?? [];
    await removeCourseObjects(admin, u.userId, ids.map((c) => c.id));
    await deleteTestUser(u.userId);
  }
});

describe("cross-user isolation", () => {
  it.each(["semesters", "courses", "events", "files"])("B cannot read A's %s", async (table) => {
    const { data, error } = await b.client.from(table).select("*");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("A can read own rows", async () => {
    const { data } = await a.client.from("courses").select("id");
    expect(data).toHaveLength(2);
  });

  it("B cannot insert a course into A's semester", async () => {
    const { error } = await b.client
      .from("courses")
      .insert({ semester_id: semesterId, name: "x", color: "#000" });
    expect(error).not.toBeNull();
  });

  it("B cannot attach an event, slot or file to A's course", async () => {
    const ev = await b.client
      .from("events")
      .insert({ course_id: courseId, kind: "assignment", title: "x", starts_at: "2026-10-20T05:00:00Z" });
    const slot = await b.client
      .from("course_slots")
      .insert({ course_id: courseId, day_of_week: 1, start_time: "09:00", end_time: "10:00" });
    const file = await b.client
      .from("files")
      .insert({ course_id: courseId, name: "x.pdf", storage_path: `${b.userId}/${courseId}/${randomUUID()}` });
    expect(ev.error).not.toBeNull();
    expect(slot.error).not.toBeNull();
    expect(file.error).not.toBeNull();
  });

  it("B cannot spoof user_id to write as A", async () => {
    const { error } = await b.client.from("semesters").insert({ user_id: a.userId, year: 2, term: 2 });
    expect(error).not.toBeNull();
  });

  it("B cannot update or delete A's rows", async () => {
    await b.client.from("courses").update({ name: "hacked" }).eq("id", courseId);
    await b.client.from("events").delete().eq("id", eventId);
    const { data: course } = await a.client.from("courses").select("name").eq("id", courseId).single();
    const { data: events } = await a.client.from("events").select("id").eq("id", eventId);
    expect(course?.name).toBe("OS");
    expect(events).toHaveLength(1);
  });

  it("B cannot download A's object", async () => {
    const { data, error } = await b.client.storage.from("materials").download(fileObject());
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("B cannot upload into A's folder", async () => {
    const { error } = await b.client.storage
      .from("materials")
      .upload(`${a.userId}/${courseId}/${randomUUID()}`, bytes());
    expect(error).not.toBeNull();
  });

  it("B cannot list or delete A's objects", async () => {
    const list = await b.client.storage.from("materials").list(`${a.userId}/${courseId}`);
    expect(list.data ?? []).toHaveLength(0);
    await b.client.storage.from("materials").remove([fileObject()]);
    const { error } = await a.client.storage.from("materials").download(fileObject());
    expect(error).toBeNull();
  });

  it("anonymous clients cannot read the bucket", async () => {
    const { error } = await anonClient().storage.from("materials").download(fileObject());
    expect(error).not.toBeNull();
  });
});

describe("constraints", () => {
  it("rejects a second midterm for one course", async () => {
    const { error } = await a.client
      .from("events")
      .insert({ course_id: courseId, kind: "midterm", title: "again", starts_at: "2026-10-21T05:00:00Z" });
    expect(error).not.toBeNull();
  });

  it("rejects contest with a course_id", async () => {
    const { error } = await a.client
      .from("events")
      .insert({ course_id: courseId, kind: "contest", title: "c", starts_at: "2026-10-21T05:00:00Z" });
    expect(error).not.toBeNull();
  });

  it("rejects assignment without a course_id", async () => {
    const { error } = await a.client
      .from("events")
      .insert({ kind: "assignment", title: "c", starts_at: "2026-10-21T05:00:00Z" });
    expect(error).not.toBeNull();
  });

  it("accepts a contest without a course_id", async () => {
    const { error } = await a.client
      .from("events")
      .insert({ kind: "contest", title: "c", starts_at: "2026-10-21T05:00:00Z" });
    expect(error).toBeNull();
  });

  it("rejects slot day_of_week = 6", async () => {
    const { error } = await a.client
      .from("course_slots")
      .insert({ course_id: courseId, day_of_week: 6, start_time: "09:00", end_time: "10:00" });
    expect(error).not.toBeNull();
  });

  it("rejects slot start >= end", async () => {
    const { error } = await a.client
      .from("course_slots")
      .insert({ course_id: courseId, day_of_week: 1, start_time: "10:00", end_time: "10:00" });
    expect(error).not.toBeNull();
  });

  it("rejects duplicate (year, term) for A but allows it for B", async () => {
    const dup = await a.client.from("semesters").insert({ year: 1, term: 1 });
    expect(dup.error).not.toBeNull();
    const ok = await b.client.from("semesters").insert({ year: 1, term: 1 });
    expect(ok.error).toBeNull();
  });
});

describe("removeCourseObjects", () => {
  it("removes one course prefix and leaves the other untouched", async () => {
    const admin = adminClient();
    const bucket = admin.storage.from("materials");
    const keep = `${a.userId}/${otherCourseId}/${randomUUID()}`;
    const extra = `${a.userId}/${courseId}/${randomUUID()}`;
    expect((await bucket.upload(keep, bytes())).error).toBeNull();
    expect((await bucket.upload(extra, bytes())).error).toBeNull();

    await removeCourseObjects(admin, a.userId, [courseId]);

    expect((await bucket.list(`${a.userId}/${courseId}`)).data).toHaveLength(0);
    expect((await bucket.list(`${a.userId}/${otherCourseId}`)).data).toHaveLength(1);
  });
});
