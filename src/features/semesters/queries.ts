import "server-only";
import { cookies } from "next/headers";
import { createServerSupabase, requireUser } from "@/lib/supabase/server";
import type { Semester } from "@/lib/domain/types";

export const SEMESTER_COOKIE = "semester_id";

type Row = { id: string; year: number; term: number };

function toSemester(row: Row): Semester {
  return { id: row.id, year: row.year as Semester["year"], term: row.term as Semester["term"] };
}

/** The signed-in user's semesters, sorted by year then term. */
export async function listSemesters(): Promise<Semester[]> {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("semesters")
    .select("id, year, term")
    .eq("user_id", user.id)
    .order("year", { ascending: true })
    .order("term", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toSemester);
}

/**
 * The semester named by the `semester_id` cookie, or the latest one (highest year, then term)
 * when the cookie is missing or names a semester that is not the user's.
 */
export async function getCurrentSemester(): Promise<Semester | null> {
  const semesters = await listSemesters();
  if (semesters.length === 0) return null;
  const cookieId = (await cookies()).get(SEMESTER_COOKIE)?.value;
  return semesters.find((s) => s.id === cookieId) ?? semesters[semesters.length - 1];
}
