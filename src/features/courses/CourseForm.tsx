"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Course, DayOfWeek, Slot } from "@/lib/domain/types";
import { saveCourse } from "./actions";
import { COURSE_COLORS, DAY_LABELS, dayLabel } from "./palette";

type Props = {
  semesterId: string;
  /** Every course in the semester, used to name overlapping courses. */
  courses: Course[];
  /** Editing when set; otherwise adding. */
  course?: Course;
  defaultColor: string;
  onDone?: () => void;
};

const blankSlot = (): Slot => ({ dayOfWeek: 1, start: "09:00", end: "10:30" });

export function CourseForm({ semesterId, courses, course, defaultColor, onDone }: Props) {
  const router = useRouter();
  const [name, setName] = useState(course?.name ?? "");
  const [professor, setProfessor] = useState(course?.professor ?? "");
  const [room, setRoom] = useState(course?.room ?? "");
  const [color, setColor] = useState(course?.color ?? defaultColor);
  const [slots, setSlots] = useState<Slot[]>(
    course?.slots.length ? course.slots.map((s) => ({ ...s })) : [blankSlot()],
  );
  const [error, setError] = useState<string | null>(null);
  const [overlaps, setOverlaps] = useState<Slot[] | null>(null);
  const [pending, startTransition] = useTransition();

  const updateSlot = (i: number, patch: Partial<Slot>) => {
    setSlots((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
    setOverlaps(null);
  };

  const submit = (confirmOverlap: boolean) =>
    startTransition(async () => {
      const result = await saveCourse({
        id: course?.id,
        semesterId,
        name,
        professor,
        room,
        color,
        slots: slots.map(({ dayOfWeek, start, end }) => ({ dayOfWeek, start, end })),
        confirmOverlap,
      });
      if (result.error) {
        setError(result.error);
        setOverlaps(null);
      } else if (result.overlaps) {
        setError(null);
        setOverlaps(result.overlaps);
      } else {
        setError(null);
        setOverlaps(null);
        router.refresh();
        onDone?.();
      }
    });

  const describe = (s: Slot) => {
    const owner = courses.find((c) => c.id === s.courseId);
    return `${owner?.name ?? "다른 강의"} (${dayLabel(s.dayOfWeek)} ${s.start}~${s.end})`;
  };

  const field = "rounded-md border border-gray-300 px-2 py-1";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
      className="mb-6 flex max-w-xl flex-col gap-3 rounded-lg border border-gray-200 p-4"
    >
      <label className="flex flex-col gap-1">
        강의 이름
        <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
      </label>
      <label className="flex flex-col gap-1">
        교수님
        <input value={professor} onChange={(e) => setProfessor(e.target.value)} className={field} />
      </label>
      <label className="flex flex-col gap-1">
        강의실
        <input value={room} onChange={(e) => setRoom(e.target.value)} className={field} />
      </label>
      <fieldset className="flex items-center gap-2">
        <legend className="mb-1">색상</legend>
        {COURSE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`색상 ${c}`}
            aria-pressed={color === c}
            onClick={() => setColor(c)}
            className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-gray-900" : "border-transparent"}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </fieldset>
      <div className="flex flex-col gap-2">
        <span>수업 시간</span>
        {slots.map((s, i) => (
          <div key={i} className="flex items-center gap-2" data-testid="slot-row">
            <select
              aria-label="요일"
              value={s.dayOfWeek}
              onChange={(e) => updateSlot(i, { dayOfWeek: Number(e.target.value) as DayOfWeek })}
              className={field}
            >
              {DAY_LABELS.map((d, idx) => (
                <option key={d} value={idx + 1}>
                  {d}
                </option>
              ))}
            </select>
            <input
              type="time"
              aria-label="시작 시간"
              value={s.start}
              onChange={(e) => updateSlot(i, { start: e.target.value })}
              className={field}
            />
            <span>~</span>
            <input
              type="time"
              aria-label="끝 시간"
              value={s.end}
              onChange={(e) => updateSlot(i, { end: e.target.value })}
              className={field}
            />
            {slots.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setSlots((prev) => prev.filter((_, j) => j !== i));
                  setOverlaps(null);
                }}
                className="rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50"
              >
                시간 삭제
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setSlots((prev) => [...prev, blankSlot()])}
          className="self-start rounded-md px-2 py-1 text-sm hover:bg-gray-100"
        >
          시간 추가
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {overlaps && (
        <div role="alert" className="rounded-md bg-amber-50 p-3 text-sm">
          <p className="mb-1 font-bold">다른 수업과 시간이 겹쳐요: {overlaps.map(describe).join(", ")}</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => submit(true)}
              className="rounded-md bg-gray-900 px-3 py-1 text-white hover:bg-gray-700 disabled:opacity-50"
            >
              그래도 저장
            </button>
            <button type="button" onClick={() => setOverlaps(null)} className="rounded-md px-3 py-1 hover:bg-gray-100">
              취소
            </button>
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-gray-900 px-3 py-2 text-white hover:bg-gray-700 disabled:opacity-50"
        >
          저장
        </button>
        {onDone && !course && (
          <button type="button" onClick={onDone} className="rounded-md px-3 py-2 hover:bg-gray-100">
            닫기
          </button>
        )}
      </div>
    </form>
  );
}
