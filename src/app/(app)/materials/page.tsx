import { getCourse, listCourses } from "@/features/courses/queries";
import { FileList } from "@/features/files/FileList";
import { MaterialsTree } from "@/features/files/MaterialsTree";
import { UploadButton } from "@/features/files/UploadButton";
import { listFiles } from "@/features/files/queries";
import { listSemesters } from "@/features/semesters/queries";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string | string[] }>;
}) {
  const { course: courseParam } = await searchParams;
  const raw = Array.isArray(courseParam) ? courseParam[0] : courseParam;
  const semesters = await listSemesters();
  const tree = await Promise.all(semesters.map(async (semester) => ({ semester, courses: await listCourses(semester.id) })));
  // An id that is not a uuid or not the user's behaves like no selection.
  const course = raw && UUID.test(raw) ? await getCourse(raw) : null;
  const files = course ? await listFiles(course.id) : [];
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">자료</h1>
      <div className="flex gap-8">
        <aside className="w-56 shrink-0">
          <MaterialsTree tree={tree} selectedCourseId={course?.id ?? null} />
        </aside>
        <section aria-label="파일" className="min-w-0 flex-1">
          {course ? (
            <>
              <h2 className="mb-3 text-lg font-semibold">{course.name}</h2>
              <UploadButton courseId={course.id} />
              <FileList files={files} />
            </>
          ) : (
            <p className="text-gray-500">왼쪽에서 강의를 골라 주세요</p>
          )}
        </section>
      </div>
    </div>
  );
}
