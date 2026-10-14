"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, requireUser } from "@/lib/supabase/server";
import { kstLocalToUtcIso } from "@/lib/domain/kst";

const BAD_DATE = "날짜와 시간을 올바르게 입력해 주세요";
const EXAM_LABEL = { midterm: "중간고사", final: "기말고사" } as const;

function toUtc(local: unknown): string | null {
  if (typeof local !== "string") return null;
  try {
    return kstLocalToUtcIso(local);
  } catch {
    return null;
  }
}

async function ownedCourseName(courseId: string, userId: string): Promise<string | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("courses")
    .select("name")
    .eq("id", courseId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.name ?? null;
}

/**
 * Sets (upserts) a course's midterm/final to `startsAt` (KST "YYYY-MM-DDTHH:MM"), or removes it when null.
 * The title is "{강의명} 중간고사"/"기말고사" at write time; it is not updated if the course is renamed later.
 */
export async function setExam(
  courseId: string,
  kind: "midterm" | "final",
  startsAt: string | null,
): Promise<{ error?: string }> {
  const user = await requireUser();
  if (kind !== "midterm" && kind !== "final") return { error: "시험 종류를 확인해 주세요" };
  const courseName = await ownedCourseName(courseId, user.id);
  if (!courseName) return { error: "강의를 찾을 수 없어요" };
  const supabase = await createServerSupabase();

  if (startsAt === null) {
    const { error } = await supabase
      .from("events")
      .delete()
      .eq("course_id", courseId)
      .eq("kind", kind)
      .eq("user_id", user.id);
    if (error) return { error: "저장하지 못했어요. 다시 시도해 주세요" };
  } else {
    const iso = toUtc(startsAt);
    if (!iso) return { error: BAD_DATE };
    const title = `${courseName} ${EXAM_LABEL[kind]}`;
    const { data: existing } = await supabase
      .from("events")
      .select("id")
      .eq("course_id", courseId)
      .eq("kind", kind)
      .eq("user_id", user.id)
      .maybeSingle();
    const { error } = existing
      ? await supabase.from("events").update({ title, starts_at: iso }).eq("id", existing.id).eq("user_id", user.id)
      : await supabase.from("events").insert({ course_id: courseId, kind, title, starts_at: iso });
    if (error) return { error: "저장하지 못했어요. 다시 시도해 주세요" };
  }
  revalidatePath("/", "layout");
  return {};
}

export async function saveAssignment(input: {
  id?: string;
  courseId: string;
  title: string;
  startsAt: string;
}): Promise<{ error?: string }> {
  const user = await requireUser();
  const title = typeof input?.title === "string" ? input.title.trim() : "";
  if (title.length === 0 || title.length > 100) return { error: "과제 이름을 입력해 주세요" };
  const iso = toUtc(input.startsAt);
  if (!iso) return { error: BAD_DATE };
  if (!(await ownedCourseName(input.courseId, user.id))) return { error: "강의를 찾을 수 없어요" };
  const supabase = await createServerSupabase();

  // kind is fixed server-side; nothing from the client can change it.
  const { error } = input.id
    ? await supabase
        .from("events")
        .update({ title, starts_at: iso })
        .eq("id", input.id)
        .eq("user_id", user.id)
        .eq("course_id", input.courseId)
        .eq("kind", "assignment")
    : await supabase.from("events").insert({ course_id: input.courseId, kind: "assignment", title, starts_at: iso });
  if (error) return { error: "저장하지 못했어요. 다시 시도해 주세요" };
  revalidatePath("/", "layout");
  return {};
}

/** Deletes one of the signed-in user's events, whatever its kind. */
export async function deleteEvent(id: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("events").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/", "layout");
}

/** Adds or edits a contest/personal event (no course). Course events can't be created or changed here. */
export async function saveStandaloneEvent(input: {
  id?: string;
  kind: "contest" | "personal";
  title: string;
  startsAt: string;
}): Promise<{ error?: string }> {
  const user = await requireUser();
  const kind: unknown = input?.kind;
  if (kind !== "contest" && kind !== "personal") return { error: "일정 종류를 확인해 주세요" };
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (title.length === 0 || title.length > 100) return { error: "일정 이름을 입력해 주세요" };
  const iso = toUtc(input.startsAt);
  if (!iso) return { error: BAD_DATE };
  const supabase = await createServerSupabase();

  if (input.id) {
    const { data, error } = await supabase
      .from("events")
      .update({ kind, title, starts_at: iso })
      .eq("id", input.id)
      .eq("user_id", user.id)
      .in("kind", ["contest", "personal"])
      .select("id");
    if (error) return { error: "저장하지 못했어요. 다시 시도해 주세요" };
    if (!data || data.length === 0) return { error: "일정을 찾을 수 없어요" };
  } else {
    const { error } = await supabase.from("events").insert({ kind, title, starts_at: iso });
    if (error) return { error: "저장하지 못했어요. 다시 시도해 주세요" };
  }
  revalidatePath("/", "layout");
  return {};
}
