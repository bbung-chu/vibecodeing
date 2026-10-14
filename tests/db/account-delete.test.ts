import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteAccountWithObjects } from "@/features/account/delete";
import { removeObjectsUnder } from "@/lib/supabase/storage";
import { adminClient, anonClient, createTestUser, deleteTestUser } from "./helpers";

const run = randomUUID().slice(0, 8);
const BUCKET = "materials";
const TABLES = ["semesters", "courses", "course_slots", "events", "files"] as const;

type Seeded = { client: SupabaseClient; userId: string };

async function seed(prefix: string): Promise<Seeded> {
  const u = await createTestUser(`${prefix}-${run}@example.test`);
  const { data: sem } = await u.client.from("semesters").insert({ year: 1, term: 1 }).select("id").single();
  const { data: course } = await u.client
    .from("courses")
    .insert({ semester_id: sem!.id, name: "OS", color: "#ef4444" })
    .select("id")
    .single();
  const slot = await u.client
    .from("course_slots")
    .insert({ course_id: course!.id, day_of_week: 1, start_time: "09:00", end_time: "10:00" });
  expect(slot.error).toBeNull();
  const ev = await u.client
    .from("events")
    .insert({ course_id: course!.id, kind: "midterm", title: "중간", starts_at: "2026-10-20T01:00:00Z" });
  expect(ev.error).toBeNull();
  for (let i = 0; i < 2; i++) {
    const path = `${u.userId}/${course!.id}/${randomUUID()}`;
    const up = await u.client.storage.from(BUCKET).upload(path, new Blob(["x"], { type: "text/plain" }));
    expect(up.error).toBeNull();
    const file = await u.client.from("files").insert({ course_id: course!.id, name: "a.txt", storage_path: path });
    expect(file.error).toBeNull();
  }
  return u;
}

async function rowCounts(userId: string): Promise<number[]> {
  const admin = adminClient();
  return Promise.all(
    TABLES.map(async (t) => {
      const { count, error } = await admin.from(t).select("id", { count: "exact", head: true }).eq("user_id", userId);
      expect(error).toBeNull();
      return count ?? 0;
    }),
  );
}

async function objectCount(userId: string): Promise<number> {
  const { data, error } = await adminClient().storage.from(BUCKET).list(userId);
  expect(error).toBeNull();
  return (data ?? []).length;
}

async function authUserExists(userId: string): Promise<boolean> {
  const { data } = await adminClient().auth.admin.getUserById(userId);
  return !!data.user;
}

let doomed: Seeded;
let bystander: Seeded;

beforeAll(async () => {
  doomed = await seed("del");
  bystander = await seed("keep");
});

afterAll(async () => {
  for (const u of [doomed, bystander]) {
    if (!u) continue;
    await removeObjectsUnder(adminClient(), u.userId);
    await deleteTestUser(u.userId);
  }
});

describe("delete_my_account", () => {
  it("cannot be called by anonymous clients", async () => {
    const { error } = await anonClient().rpc("delete_my_account");
    expect(error).not.toBeNull();
  });

  it("refuses while the caller still has storage objects", async () => {
    const { error } = await doomed.client.rpc("delete_my_account");
    expect(error).not.toBeNull();
    expect(await authUserExists(doomed.userId)).toBe(true);
  });

  it("deletes only the caller, their rows and their objects", async () => {
    expect(await rowCounts(doomed.userId)).toEqual([1, 1, 1, 1, 2]);
    await deleteAccountWithObjects(doomed.client, doomed.userId);

    expect(await authUserExists(doomed.userId)).toBe(false);
    expect(await rowCounts(doomed.userId)).toEqual([0, 0, 0, 0, 0]);
    expect(await objectCount(doomed.userId)).toBe(0);

    expect(await authUserExists(bystander.userId)).toBe(true);
    expect(await rowCounts(bystander.userId)).toEqual([1, 1, 1, 1, 2]);
    expect(await objectCount(bystander.userId)).toBe(1); // one course folder
  });
});
