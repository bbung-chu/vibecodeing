import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { persistCourse } from "@/features/courses/save";
import type { Slot } from "@/lib/domain/types";
import { createTestUser, deleteTestUser } from "./helpers";

const run = randomUUID().slice(0, 8);
let user: { client: SupabaseClient; userId: string };
let semesterId: string;

const fields = (name: string) => ({ name, professor: null, room: null, color: "#f87171" });
// day 6 bypasses domain validation; the DB check rejects it.
const badSlot = { dayOfWeek: 6, start: "09:00", end: "10:00" } as unknown as Slot;
const goodSlot: Slot = { dayOfWeek: 2, start: "13:00", end: "14:00" };

beforeAll(async () => {
  user = await createTestUser(`cs-${run}@example.test`);
  const { data } = await user.client.from("semesters").insert({ year: 1, term: 1 }).select("id").single();
  semesterId = data!.id;
});
afterAll(async () => {
  await deleteTestUser(user.userId);
});

describe("persistCourse", () => {
  it("keeps the original slots when the replacement insert fails on edit", async () => {
    const created = await persistCourse(user.client, user.userId, {
      semesterId,
      fields: fields("OS"),
      slots: [goodSlot],
    });
    expect(created.id).toBeDefined();
    const result = await persistCourse(user.client, user.userId, {
      id: created.id,
      semesterId,
      fields: fields("OS2"),
      slots: [badSlot],
    });
    expect(result.error).toBeDefined();
    const { data } = await user.client.from("course_slots").select("day_of_week, start_time").eq("course_id", created.id!);
    expect(data).toHaveLength(1);
    expect(data![0].day_of_week).toBe(2);
  });

  it("replaces slots on a successful edit", async () => {
    const created = await persistCourse(user.client, user.userId, { semesterId, fields: fields("A"), slots: [goodSlot] });
    const result = await persistCourse(user.client, user.userId, {
      id: created.id,
      semesterId,
      fields: fields("A"),
      slots: [{ dayOfWeek: 4, start: "09:00", end: "10:00" }],
    });
    expect(result.error).toBeUndefined();
    const { data } = await user.client.from("course_slots").select("day_of_week").eq("course_id", created.id!);
    expect(data).toEqual([{ day_of_week: 4 }]);
  });

  it("leaves no course row when the slot insert fails on create", async () => {
    const result = await persistCourse(user.client, user.userId, {
      semesterId,
      fields: fields("Orphan"),
      slots: [badSlot],
    });
    expect(result.error).toBeDefined();
    const { data } = await user.client.from("courses").select("id").eq("name", "Orphan");
    expect(data).toHaveLength(0);
  });

  it("renames the course's midterm and final titles with the course", async () => {
    const created = await persistCourse(user.client, user.userId, { semesterId, fields: fields("운영체제"), slots: [goodSlot] });
    const ins = await user.client.from("events").insert([
      { course_id: created.id, kind: "midterm", title: "운영체제 중간고사", starts_at: "2026-10-20T01:00:00Z" },
      { course_id: created.id, kind: "final", title: "운영체제 기말고사", starts_at: "2026-12-15T01:00:00Z" },
      { course_id: created.id, kind: "assignment", title: "운영체제 과제", starts_at: "2026-11-01T01:00:00Z" },
    ]);
    expect(ins.error).toBeNull();
    const result = await persistCourse(user.client, user.userId, {
      id: created.id,
      semesterId,
      fields: fields("운영체제론"),
      slots: [goodSlot],
    });
    expect(result.error).toBeUndefined();
    const { data } = await user.client.from("events").select("kind, title").eq("course_id", created.id!).order("kind");
    expect(data).toEqual([
      { kind: "assignment", title: "운영체제 과제" },
      { kind: "final", title: "운영체제론 기말고사" },
      { kind: "midterm", title: "운영체제론 중간고사" },
    ]);
  });
});
