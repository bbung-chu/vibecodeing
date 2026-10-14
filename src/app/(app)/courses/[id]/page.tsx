import { notFound } from "next/navigation";
import { CourseForm } from "@/features/courses/CourseForm";
import { DeleteCourseButton } from "@/features/courses/DeleteCourseButton";
import { getCourse, listCourses } from "@/features/courses/queries";
import { AssignmentList } from "@/features/events/AssignmentList";
import { ExamFields } from "@/features/events/ExamFields";
import { listCourseEvents } from "@/features/events/queries";
import { utcIsoToKstLocal } from "@/lib/domain/kst";

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // A non-uuid id would make Postgres error; treat it as not found.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const course = await getCourse(id);
  if (!course) notFound();
  const courses = await listCourses(course.semesterId);
  const events = await listCourseEvents(course.id);
  const examAt = (kind: "midterm" | "final") => {
    const e = events.find((x) => x.kind === kind);
    return e ? utcIsoToKstLocal(e.startsAt) : "";
  };
  const assignments = events
    .filter((e) => e.kind === "assignment")
    .map((e) => ({ id: e.id, title: e.title, startsAtKst: utcIsoToKstLocal(e.startsAt) }));
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{course.name}</h1>
      <section aria-label="강의 정보">
        <CourseForm semesterId={course.semesterId} courses={courses} course={course} defaultColor={course.color} />
        <DeleteCourseButton id={course.id} />
      </section>
      <section aria-label="시험" className="mt-8">
        <h2 className="mb-2 text-lg font-semibold">시험</h2>
        <ExamFields courseId={course.id} kind="midterm" initial={examAt("midterm")} />
        <ExamFields courseId={course.id} kind="final" initial={examAt("final")} />
      </section>
      <section aria-label="과제" className="mt-8">
        <h2 className="mb-2 text-lg font-semibold">과제</h2>
        <AssignmentList courseId={course.id} assignments={assignments} />
      </section>
    </div>
  );
}
