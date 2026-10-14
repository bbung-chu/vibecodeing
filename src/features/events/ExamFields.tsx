"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setExam } from "./actions";

type Props = { courseId: string; kind: "midterm" | "final"; initial: string };

const LABEL = { midterm: "중간고사", final: "기말고사" } as const;

/** `initial` is a KST "YYYY-MM-DDTHH:MM" string, or "" when unset. */
export function ExamFields({ courseId, kind, initial }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const label = `${LABEL[kind]} 일시`;

  const run = (next: string | null) =>
    startTransition(async () => {
      const result = await setExam(courseId, kind, next);
      setError(result.error ?? null);
      if (!result.error) {
        if (next === null) setValue("");
        router.refresh();
      }
    });

  return (
    <div data-testid={`exam-${kind}`} className="mb-3 flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2">
        <span className="w-28 font-medium">{label}</span>
        <input
          type="datetime-local"
          aria-label={label}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="rounded-md border px-2 py-1"
        />
      </label>
      <button
        type="button"
        disabled={pending || value === ""}
        onClick={() => run(value)}
        className="rounded-md bg-blue-600 px-3 py-1 text-white disabled:opacity-50"
      >
        저장
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(null)}
        className="rounded-md px-3 py-1 hover:bg-gray-100 disabled:opacity-50"
      >
        지우기
      </button>
      {error && <p role="alert" className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}
