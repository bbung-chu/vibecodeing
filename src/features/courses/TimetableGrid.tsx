import Link from "next/link";
import { timetableRange } from "@/lib/domain/slots";
import type { Course } from "@/lib/domain/types";
import { DAY_LABELS } from "./palette";

const ROW_PX = 56;
const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export function TimetableGrid({ courses }: { courses: Course[] }) {
  const { startHour, endHour } = timetableRange(courses.flatMap((c) => c.slots));
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const height = hours.length * ROW_PX;

  return (
    <div className="grid grid-cols-[3.5rem_repeat(5,minmax(0,1fr))] text-sm" data-testid="timetable">
      <div />
      {DAY_LABELS.map((d) => (
        <div key={d} className="border-b border-gray-300 py-2 text-center font-bold">
          {d}
        </div>
      ))}
      <div style={{ height }}>
        {hours.map((h) => (
          <div key={h} style={{ height: ROW_PX }} className="pr-2 text-right text-xs text-gray-500">
            {String(h).padStart(2, "0")}:00
          </div>
        ))}
      </div>
      {DAY_LABELS.map((label, i) => (
        <div
          key={label}
          data-testid={`day-${label}`}
          className="relative border-l border-gray-200"
          style={{
            height,
            backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${ROW_PX - 1}px, #e5e7eb ${ROW_PX - 1}px, #e5e7eb ${ROW_PX}px)`,
          }}
        >
          {courses.flatMap((c) =>
            c.slots
              .filter((s) => s.dayOfWeek === i + 1)
              .map((s) => {
                const top = ((minutes(s.start) - startHour * 60) / 60) * ROW_PX;
                const h = ((minutes(s.end) - minutes(s.start)) / 60) * ROW_PX;
                return (
                  <Link
                    key={`${c.id}-${s.start}-${s.end}`}
                    href={`/courses/${c.id}`}
                    data-testid="course-block"
                    className="absolute inset-x-0.5 overflow-hidden rounded-md p-1 text-xs text-gray-900 shadow-sm hover:brightness-95"
                    style={{ top, height: h, backgroundColor: c.color }}
                  >
                    <div className="font-bold">{c.name}</div>
                    {c.room && <div>{c.room}</div>}
                  </Link>
                );
              }),
          )}
        </div>
      ))}
    </div>
  );
}
