import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/** E2E-only email+password sign-in. Hidden (404) outside a non-production E2E run. */
function enabled(): boolean {
  return process.env.E2E === "1" && process.env.NODE_ENV !== "production";
}

async function signIn(request: Request, email: string | null, password: string | null) {
  if (!email || !password) return new NextResponse("Bad Request", { status: 400 });
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return new NextResponse("Unauthorized", { status: 401 });
  return NextResponse.redirect(new URL("/", request.url), 303);
}

export async function POST(request: Request) {
  if (!enabled()) return new NextResponse("Not Found", { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
  return signIn(request, body.email ?? null, body.password ?? null);
}
