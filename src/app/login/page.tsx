"use client";

import { createBrowserSupabase } from "@/lib/supabase/client";

export default function LoginPage() {
  async function signIn() {
    await createBrowserSupabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-bold">강의 정리</h1>
      <button
        type="button"
        onClick={signIn}
        className="rounded-md border border-gray-300 px-5 py-2.5 font-medium hover:bg-gray-50"
      >
        구글로 계속하기
      </button>
    </main>
  );
}
