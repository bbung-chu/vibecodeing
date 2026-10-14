import { notFound } from "next/navigation";
import { CourseForm } from "@/features/courses/CourseForm";
import { DeleteCourseButton } from "@/features/courses/DeleteCourseButton";
import { getCourse, listCourses } from "@/features/courses/queries";

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // A non-uuid id would make Postgres error; treat it as not found.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const course = await getCourse(id);
  if (!course) notFound();
  const courses = await listCourses(course.semesterId);
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{course.name}</h1>
      <section aria-label="강의 정보">
        <CourseForm semesterId={course.semesterId} courses={courses} course={course} defaultColor={course.color} />
        <DeleteCourseButton id={course.id} />
      </section>
    </div>
  );
}
