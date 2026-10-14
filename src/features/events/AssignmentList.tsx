"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteEvent, saveAssignment } from "./actions";

export type AssignmentItem = { id: string; title: string; startsAtKst: string };

type Props = { courseId: string; assignments: AssignmentItem[] };

/** `startsAtKst` is "YYYY-MM-DDTHH:MM" in KST; the list arrives sorted by deadline. */
export function AssignmentList({ courseId, assignments }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      const result = await saveAssignment({ courseId, title, startsAt });
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setTitle("");
      setStartsAt("");
      router.refresh();
    });

  const remove = (id: string) =>
    startTransition(async () => {
      await deleteEvent(id);
      router.refresh();
    });

  return (
    <div>
      <ul className="mb-3">
        {assignments.map((a) => (
          <li key={a.id} data-testid="assignment-row" className="flex items-center gap-3 py-1">
            <span className="font-medium">{a.title}</span>
            <span className="text-gray-600">{a.startsAtKst.replace("T", " ")}</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => remove(a.id)}
              className="rounded-md px-2 py-1 text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              삭제
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2">
          <span>과제 이름</span>
          <input
            value={title}
            maxLength={100}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-md border px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-2">
          <span>마감 일시</span>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="rounded-md border px-2 py-1"
          />
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={add}
          className="rounded-md bg-blue-600 px-3 py-1 text-white disabled:opacity-50"
        >
          과제 추가
        </button>
        {error && <p role="alert" className="w-full text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
