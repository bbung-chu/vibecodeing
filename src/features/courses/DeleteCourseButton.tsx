"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { deleteCourse } from "./actions";

export function DeleteCourseButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirming(true)}
        className="rounded-md px-3 py-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        강의 삭제
      </button>
      {confirming && (
        <ConfirmDialog
          title="강의 삭제"
          message="이 강의의 일정과 파일이 모두 지워져요. 삭제할까요?"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            startTransition(async () => {
              await deleteCourse(id);
              router.push("/timetable");
            });
          }}
        />
      )}
    </>
  );
}
