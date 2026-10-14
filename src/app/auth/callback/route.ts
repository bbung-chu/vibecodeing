import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/safe-next";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(safeNextPath(searchParams.get("next")), origin));
    }
  }
  return NextResponse.redirect(new URL("/login", origin));
}
