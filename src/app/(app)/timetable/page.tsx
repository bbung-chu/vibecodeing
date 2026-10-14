import { AddCourse } from "@/features/courses/AddCourse";
import { TimetableGrid } from "@/features/courses/TimetableGrid";
import { nextColor } from "@/features/courses/palette";
import { listCourses } from "@/features/courses/queries";
import { getCurrentSemester } from "@/features/semesters/queries";

export default async function TimetablePage() {
  const semester = await getCurrentSemester();
  // The layout's semester picker already shows the empty-state text.
  if (!semester) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-bold">시간표</h1>
      </div>
    );
  }
  const courses = await listCourses(semester.id);
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">시간표</h1>
      <AddCourse semesterId={semester.id} courses={courses} defaultColor={nextColor(courses.length)} />
      <TimetableGrid courses={courses} />
    </div>
  );
}
