import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { removeCourseObjects } from "@/lib/supabase/storage";
import { adminClient, createTestUser, deleteTestUser } from "./helpers";

const run = randomUUID().slice(0, 8);
const BUCKET = "materials";
const bytes = () => new Blob(["hi"], { type: "text/plain" });

let user: { client: SupabaseClient; userId: string };
let courseId: string;

async function names(prefix: string): Promise<string[]> {
  const { data, error } = await adminClient().storage.from(BUCKET).list(prefix, { limit: 1000 });
  expect(error).toBeNull();
  return (data ?? []).map((o) => o.name);
}

/** Wraps a client so storage calls of one kind misbehave. */
function brokenStorage(client: SupabaseClient, method: "remove" | "list", result: unknown): SupabaseClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop !== "storage") return Reflect.get(target, prop, receiver);
      return {
        from: (bucket: string) => {
          const api = target.storage.from(bucket);
          return new Proxy(api, {
            get(t, p, r) {
              if (p === method) return () => Promise.resolve(result);
              const v = Reflect.get(t, p, r);
              return typeof v === "function" ? v.bind(t) : v;
            },
          });
        },
      };
    },
  });
}

beforeAll(async () => {
  user = await createTestUser(`sc-${run}@example.test`);
  const { data: sem } = await user.client.from("semesters").insert({ year: 1, term: 1 }).select("id").single();
  const { data: course } = await user.client
    .from("courses")
    .insert({ semester_id: sem!.id, name: "OS", color: "#ef4444" })
    .select("id")
    .single();
  courseId = course!.id;
});

afterAll(async () => {
  await removeCourseObjects(adminClient(), user.userId, [courseId]).catch(() => undefined);
  await deleteTestUser(user.userId);
});

describe("removeCourseObjects", () => {
  it("removes more than one page (100+) of objects", async () => {
    const prefix = `${user.userId}/${courseId}`;
    const bucket = user.client.storage.from(BUCKET);
    await Promise.all(
      Array.from({ length: 130 }, async () => {
        const { error } = await bucket.upload(`${prefix}/${randomUUID()}`, bytes(), { contentType: "text/plain" });
        expect(error).toBeNull();
      }),
    );
    expect(await names(prefix)).toHaveLength(130);
    await removeCourseObjects(user.client, user.userId, [courseId]);
    expect(await names(prefix)).toEqual([]);
  }, 60_000);

  it("removes nested objects under the course prefix", async () => {
    const prefix = `${user.userId}/${courseId}`;
    // Only possible through the service role (the insert policy forbids nesting), e.g. legacy objects.
    const { error } = await adminClient().storage.from(BUCKET).upload(`${prefix}/sub/deep`, bytes(), { contentType: "text/plain" });
    expect(error).toBeNull();
    await removeCourseObjects(user.client, user.userId, [courseId]);
    expect(await names(prefix)).toEqual([]);
  });

  it("throws when storage removes fewer objects than listed", async () => {
    const path = `${user.userId}/${courseId}/${randomUUID()}`;
    expect((await user.client.storage.from(BUCKET).upload(path, bytes(), { contentType: "text/plain" })).error).toBeNull();
    const silent = brokenStorage(user.client, "remove", { data: [], error: null });
    await expect(removeCourseObjects(silent, user.userId, [courseId])).rejects.toThrow();
    await removeCourseObjects(user.client, user.userId, [courseId]);
  });

  it("throws when listing fails", async () => {
    const failing = brokenStorage(user.client, "list", { data: null, error: new Error("boom") });
    await expect(removeCourseObjects(failing, user.userId, [courseId])).rejects.toThrow();
  });
});
