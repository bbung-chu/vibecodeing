import { Sidebar } from "@/components/Sidebar";
import { SemesterPicker } from "@/features/semesters/SemesterPicker";
import { getCurrentSemester, listSemesters } from "@/features/semesters/queries";
import { requireUser } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const [semesters, current] = await Promise.all([listSemesters(), getCurrentSemester()]);
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-56 min-w-0 flex-1 p-8">
        <SemesterPicker semesters={semesters} currentId={current?.id ?? null} />
        {children}
      </main>
    </div>
  );
}
