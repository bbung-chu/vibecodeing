import { listCourses } from "@/features/courses/queries";
import { listEvents } from "@/features/events/queries";
import { HomeView } from "@/features/home/HomeView";
import { getCurrentSemester } from "@/features/semesters/queries";

const DAY_MS = 86_400_000;

export default async function HomePage() {
  const semester = await getCurrentSemester();
  const courses = semester ? await listCourses(semester.id) : [];
  // Wider than the 30-day view: the browser clock decides what is shown (see HomeView).
  const now = Date.now();
  const events = await listEvents({
    from: new Date(now - 2 * DAY_MS).toISOString(),
    to: new Date(now + 40 * DAY_MS).toISOString(),
  });
  return <HomeView courses={courses} events={events} />;
}
