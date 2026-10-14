"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, requireUser } from "@/lib/supabase/server";
import { findOverlaps, validateSlot } from "@/lib/domain/slots";
import type { Slot } from "@/lib/domain/types";
import { deleteCourseWithObjects } from "./delete";
import { listCourses } from "./queries";
import { COURSE_COLORS } from "./palette";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

type SaveInput = {
  id?: string;
  semesterId: string;
  name: string;
  professor?: string;
  room?: string;
  color: string;
  slots: Slot[];
  confirmOverlap?: boolean;
};

export async function saveCourse(
  input: SaveInput,
): Promise<{ id?: string; error?: string; overlaps?: Slot[] }> {
  const user = await requireUser();
  const name = (input.name ?? "").trim();
  if (name.length === 0 || name.length > 50) return { error: "강의 이름을 입력해 주세요" };
  if (!Array.isArray(input.slots) || input.slots.length === 0) {
    return { error: "수업 시간을 하나 이상 넣어 주세요" };
  }
  const slots: Slot[] = [];
  for (const s of input.slots) {
    if (typeof s?.start !== "string" || typeof s?.end !== "string" || !TIME.test(s.start) || !TIME.test(s.end)) {
      return { error: "시간 형식이 올바르지 않아요" };
    }
    const slot: Slot = { dayOfWeek: s.dayOfWeek, start: s.start, end: s.end };
    const slotError = validateSlot(slot);
    if (slotError) return { error: slotError };
    slots.push(slot);
  }
  if (!(COURSE_COLORS as readonly string[]).includes(input.color)) {
    return { error: "색상을 확인해 주세요" };
  }

  const supabase = await createServerSupabase();
  const { data: semester } = await supabase
    .from("semesters")
    .select("id")
    .eq("id", input.semesterId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!semester) return { error: "학기를 찾을 수 없어요" };

  if (!input.confirmOverlap) {
    const others = (await listCourses(input.semesterId)).filter((c) => c.id !== input.id);
    const overlaps = findOverlaps(slots, others.flatMap((c) => c.slots));
    if (overlaps.length > 0) return { overlaps };
  }

  const fields = {
    name,
    professor: input.professor?.trim() || null,
    room: input.room?.trim() || null,
    color: input.color,
  };
  let courseId = input.id;
  if (courseId) {
    const { data, error } = await supabase
      .from("courses")
      .update(fields)
      .eq("id", courseId)
      .eq("user_id", user.id)
      .eq("semester_id", input.semesterId)
      .select("id")
      .maybeSingle();
    if (error || !data) return { error: "강의를 저장하지 못했어요" };
  } else {
    const { data, error } = await supabase
      .from("courses")
      .insert({ ...fields, user_id: user.id, semester_id: input.semesterId })
      .select("id")
      .single();
    if (error) return { error: "강의를 저장하지 못했어요" };
    courseId = data.id as string;
  }

  const { error: delError } = await supabase
    .from("course_slots")
    .delete()
    .eq("course_id", courseId)
    .eq("user_id", user.id);
  if (delError) return { error: "수업 시간을 저장하지 못했어요" };
  const { error: insError } = await supabase.from("course_slots").insert(
    slots.map((s) => ({
      user_id: user.id,
      course_id: courseId,
      day_of_week: s.dayOfWeek,
      start_time: s.start,
      end_time: s.end,
    })),
  );
  if (insError) return { error: "수업 시간을 저장하지 못했어요" };

  revalidatePath("/", "layout");
  return { id: courseId };
}

export async function deleteCourse(id: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  await deleteCourseWithObjects(supabase, user.id, id);
  revalidatePath("/", "layout");
}
