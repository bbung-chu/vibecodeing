"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServerSupabase, requireUser } from "@/lib/supabase/server";
import { removeCourseObjects } from "@/lib/supabase/storage";
import { SEMESTER_COOKIE } from "./queries";

const COOKIE_OPTIONS = { httpOnly: true, sameSite: "lax", path: "/" } as const;
const UNIQUE_VIOLATION = "23505";

export async function createSemester(year: number | string, term: number | string): Promise<{ error?: string }> {
  const user = await requireUser();
  const y = Number(year);
  const t = Number(term);
  if (!Number.isInteger(y) || y < 1 || y > 4 || !Number.isInteger(t) || t < 1 || t > 2) {
    return { error: "학년과 학기를 확인해 주세요" };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("semesters")
    .insert({ user_id: user.id, year: y, term: t })
    .select("id")
    .single();
  if (error) {
    return { error: error.code === UNIQUE_VIOLATION ? "이미 있는 학기예요" : "학기를 추가하지 못했어요" };
  }
  (await cookies()).set(SEMESTER_COOKIE, data.id, COOKIE_OPTIONS);
  revalidatePath("/", "layout");
  return {};
}

export async function selectSemester(id: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("semesters")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return;
  (await cookies()).set(SEMESTER_COOKIE, data.id, COOKIE_OPTIONS);
  revalidatePath("/", "layout");
}

export async function deleteSemester(id: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  const { data: courses, error: coursesError } = await supabase
    .from("courses")
    .select("id")
    .eq("semester_id", id)
    .eq("user_id", user.id);
  if (coursesError) throw coursesError;
  await removeCourseObjects(supabase, user.id, (courses ?? []).map((c) => c.id));
  const { error } = await supabase.from("semesters").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw error;
  const store = await cookies();
  if (store.get(SEMESTER_COOKIE)?.value === id) store.delete(SEMESTER_COOKIE);
  revalidatePath("/", "layout");
}
