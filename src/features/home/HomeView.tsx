"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ddayCount, formatDday, todayClasses, upcomingEvents } from "@/lib/domain/dday";
import { utcIsoToKstLocal } from "@/lib/domain/kst";
import type { Course } from "@/lib/domain/types";
import { KIND_LABEL } from "@/features/events/kinds";
import type { EventWithCourse } from "@/features/events/queries";

/** Computes with the browser clock so the KST day is right regardless of the server's clock or timezone. */
export function HomeView({ courses, events }: { courses: Course[]; events: EventWithCourse[] }) {
  // Set after mount so the server render never depends on the server clock.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  if (!now) return <h1 className="text-2xl font-bold">홈</h1>;

  const classes = todayClasses(courses, now);
  const upcoming = upcomingEvents(events, now);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">홈</h1>

      <section aria-labelledby="home-classes">
        <h2 id="home-classes" className="mb-2 text-lg font-semibold">오늘 수업</h2>
        {classes.length === 0 ? (
          <p className="text-slate-500">오늘은 수업이 없어요</p>
        ) : (
          <ul className="space-y-2">
            {classes.map(({ course, slot }) => (
              <li key={`${course.id}-${slot.start}`} className="flex items-center gap-3 rounded border border-slate-200 p-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: course.color }} aria-hidden />
                <Link href={`/courses/${course.id}`} className="font-medium hover:underline">{course.name}</Link>
                <span className="text-slate-600">{slot.start}–{slot.end}</span>
                {course.room && <span className="text-slate-500">{course.room}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="home-upcoming">
        <h2 id="home-upcoming" className="mb-2 text-lg font-semibold">다가오는 일정</h2>
        {upcoming.length === 0 ? (
          <p className="text-slate-500">다가오는 일정이 없어요</p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((e) => {
              const local = utcIsoToKstLocal(e.startsAt);
              const body = (
                <>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-sm text-slate-700">{KIND_LABEL[e.kind]}</span>
                  {e.courseName && (
                    <span className="flex items-center gap-1.5 text-sm text-slate-600">
                      <span
                        data-testid="event-course-dot"
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: e.color ?? undefined }}
                        aria-hidden
                      />
                      <span data-testid="event-course">{e.courseName}</span>
                    </span>
                  )}
                  <span className="font-medium">{e.title}</span>
                  <span className="text-slate-600">{local.slice(0, 10)} {local.slice(11)}</span>
                  <span className="ml-auto font-semibold">{formatDday(ddayCount(new Date(e.startsAt), now))}</span>
                </>
              );
              const cls = "flex items-center gap-3 rounded border border-slate-200 p-3";
              return (
                <li key={e.id} data-testid="home-event">
                  {e.courseId ? (
                    <Link href={`/courses/${e.courseId}`} className={`${cls} hover:bg-slate-50`}>{body}</Link>
                  ) : (
                    <div className={cls}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
