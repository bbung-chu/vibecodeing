import Link from "next/link";
import type { Course, Semester } from "@/lib/domain/types";

export type TreeSemester = { semester: Semester; courses: Course[] };

export function MaterialsTree({ tree, selectedCourseId }: { tree: TreeSemester[]; selectedCourseId: string | null }) {
  if (tree.length === 0) return <p className="text-sm text-gray-500">학기를 먼저 추가해 주세요</p>;
  const years = [...new Set(tree.map((t) => t.semester.year))];
  return (
    <ul aria-label="강의 목록" className="space-y-3">
      {years.map((year) => (
        <li key={year}>
          <div className="font-semibold">{year}학년</div>
          <ul className="ml-3 space-y-2">
            {tree
              .filter((t) => t.semester.year === year)
              .map(({ semester, courses }) => (
                <li key={semester.id}>
                  <div className="text-sm text-gray-600">{semester.term}학기</div>
                  <ul className="ml-3">
                    {courses.length === 0 && <li className="text-sm text-gray-400">강의 없음</li>}
                    {courses.map((c) => (
                      <li key={c.id}>
                        <Link
                          href={`/materials?course=${c.id}`}
                          aria-current={c.id === selectedCourseId ? "true" : undefined}
                          className={`block rounded-md px-2 py-1 hover:bg-gray-100 ${c.id === selectedCourseId ? "bg-gray-200 font-medium" : ""}`}
                        >
                          {c.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
