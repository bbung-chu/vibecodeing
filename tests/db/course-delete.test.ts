import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteCourseWithObjects } from "@/features/courses/delete";
import { createTestUser, deleteTestUser } from "./helpers";

const run = randomUUID().slice(0, 8);

let user: { client: SupabaseClient; userId: string };
let courseId: string;

async function count(table: string): Promise<number> {
  const { count: n, error } = await user.client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);
  expect(error).toBeNull();
  return n ?? 0;
}

beforeAll(async () => {
  user = await createTestUser(`cd-${run}@example.test`);
  const { data: sem } = await user.client.from("semesters").insert({ year: 1, term: 1 }).select("id").single();
  const { data: course } = await user.client
    .from("courses")
    .insert({ semester_id: sem!.id, name: "OS", color: "#ef4444" })
    .select("id")
    .single();
  courseId = course!.id;
  const slot = await user.client
    .from("course_slots")
    .insert({ course_id: courseId, day_of_week: 1, start_time: "10:00", end_time: "11:00" });
  expect(slot.error).toBeNull();
  const ev = await user.client
    .from("events")
    .insert({ course_id: courseId, kind: "midterm", title: "중간", starts_at: "2026-10-20T01:00:00Z" });
  expect(ev.error).toBeNull();
  const path = `${user.userId}/${courseId}/x`;
  const up = await user.client.storage.from("materials").upload(path, new Blob(["hi"], { type: "text/plain" }));
  expect(up.error).toBeNull();
  const file = await user.client
    .from("files")
    .insert({ course_id: courseId, name: "x.txt", size_bytes: 2, mime_type: "text/plain", storage_path: path });
  expect(file.error).toBeNull();
});

afterAll(async () => {
  await deleteTestUser(user.userId);
});

describe("deleteCourseWithObjects", () => {
  it("removes the course, slots, events, file rows and storage objects", async () => {
    expect(await count("course_slots")).toBe(1);
    await deleteCourseWithObjects(user.client, user.userId, courseId);
    expect(await count("course_slots")).toBe(0);
    expect(await count("events")).toBe(0);
    expect(await count("files")).toBe(0);
    const { data: course } = await user.client.from("courses").select("id").eq("id", courseId);
    expect(course).toHaveLength(0);
    const { data: objects, error } = await user.client.storage
      .from("materials")
      .list(`${user.userId}/${courseId}`);
    expect(error).toBeNull();
    expect(objects ?? []).toHaveLength(0);
  });
});
