import { Sidebar } from "@/components/Sidebar";
import { requireUser } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-56 min-w-0 flex-1 p-8">{children}</main>
    </div>
  );
}
