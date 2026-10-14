import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

const LINKS = [
  { href: "/", label: "홈" },
  { href: "/timetable", label: "시간표" },
  { href: "/materials", label: "자료" },
  { href: "/schedule", label: "일정" },
];

async function logout() {
  "use server";
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}

export function Sidebar() {
  return (
    <nav className="fixed inset-y-0 left-0 flex w-56 flex-col border-r border-gray-200 bg-gray-50 p-4">
      <div className="mb-6 text-lg font-bold">강의 정리</div>
      <ul className="flex flex-1 flex-col gap-1">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="block rounded-md px-3 py-2 hover:bg-gray-200">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
      <form action={logout}>
        <button type="submit" className="w-full rounded-md px-3 py-2 text-left hover:bg-gray-200">
          로그아웃
        </button>
      </form>
    </nav>
  );
}
