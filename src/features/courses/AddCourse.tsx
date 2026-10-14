"use client";

import { useState } from "react";
import type { Course } from "@/lib/domain/types";
import { CourseForm } from "./CourseForm";

export function AddCourse({ semesterId, courses, defaultColor }: { semesterId: string; courses: Course[]; defaultColor: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-6 rounded-md bg-gray-900 px-3 py-2 text-white hover:bg-gray-700"
      >
        강의 추가
      </button>
    );
  }
  return (
    <CourseForm semesterId={semesterId} courses={courses} defaultColor={defaultColor} onDone={() => setOpen(false)} />
  );
}
