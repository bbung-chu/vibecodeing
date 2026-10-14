"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { Semester } from "@/lib/domain/types";
import { createSemester, deleteSemester, selectSemester } from "./actions";

const label = (s: Semester) => `${s.year}학년 ${s.term}학기`;

export function SemesterPicker({ semesters, currentId }: { semesters: Semester[]; currentId: string | null }) {
  const [year, setYear] = useState("1");
  const [term, setTerm] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      const result = await createSemester(year, term);
      setError(result.error ?? null);
    });

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      {semesters.length === 0 ? (
        <p className="text-gray-600">아직 학기가 없어요. 학기를 추가해 주세요.</p>
      ) : (
        <>
          <select
            aria-label="학기 선택"
            value={currentId ?? ""}
            disabled={pending}
            onChange={(e) => startTransition(() => selectSemester(e.target.value))}
            className="rounded-md border border-gray-300 px-2 py-1"
          >
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {label(s)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50"
          >
            학기 삭제
          </button>
        </>
      )}
      <span className="mx-2 h-5 border-l border-gray-300" />
      <select
        aria-label="학년"
        value={year}
        onChange={(e) => setYear(e.target.value)}
        className="rounded-md border border-gray-300 px-2 py-1"
      >
        {[1, 2, 3, 4].map((y) => (
          <option key={y} value={y}>
            {y}학년
          </option>
        ))}
      </select>
      <select
        aria-label="학기"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        className="rounded-md border border-gray-300 px-2 py-1"
      >
        {[1, 2].map((t) => (
          <option key={t} value={t}>
            {t}학기
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={add}
        disabled={pending}
        className="rounded-md bg-gray-900 px-3 py-1 text-white hover:bg-gray-700 disabled:opacity-50"
      >
        학기 추가
      </button>
      {error && (
        <span role="alert" className="text-sm text-red-600">
          {error}
        </span>
      )}
      {confirming && currentId && (
        <ConfirmDialog
          title="학기 삭제"
          message="이 학기의 강의, 일정, 파일이 모두 지워져요. 삭제할까요?"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            startTransition(() => deleteSemester(currentId));
          }}
        />
      )}
    </div>
  );
}
