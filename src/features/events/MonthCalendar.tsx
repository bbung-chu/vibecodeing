"use client";

import Link from "next/link";
import { useState } from "react";
import { EventForm, type EventDraft } from "./EventForm";
import { STANDALONE_CLASS, isStandalone, type ScheduleEvent } from "./kinds";
import type { MonthCell } from "./month";

type Props = {
  title: string; // "2026년 10월"
  prevHref: string;
  nextHref: string;
  listHref: string;
  weeks: MonthCell[][];
  events: ScheduleEvent[];
  todayKey: string;
  defaultLocal: string;
};

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

export function MonthCalendar({ title, prevHref, nextHref, listHref, weeks, events, todayKey, defaultLocal }: Props) {
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const byDay = new Map<string, ScheduleEvent[]>();
  for (const e of events) byDay.set(e.dateKey, [...(byDay.get(e.dateKey) ?? []), e]);

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <Link href={prevHref} className="rounded-md px-2 py-1 hover:bg-gray-100">
          이전 달
        </Link>
        <h2 className="text-lg font-semibold">{title}</h2>
        <Link href={nextHref} className="rounded-md px-2 py-1 hover:bg-gray-100">
          다음 달
        </Link>
        <span className="ml-auto flex items-center gap-2">
          <span className="rounded-md bg-gray-200 px-3 py-1 text-sm">달력</span>
          <Link href={listHref} className="rounded-md px-3 py-1 text-sm hover:bg-gray-100">
            목록
          </Link>
          <button
            type="button"
            onClick={() => setDraft({ kind: "contest", title: "", local: defaultLocal })}
            className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white"
          >
            일정 추가
          </button>
        </span>
      </div>
      {draft && <EventForm key={draft.id ?? "new"} initial={draft} onClose={() => setDraft(null)} />}
      <div className="grid grid-cols-7 border-l border-t text-sm">
        {WEEKDAYS.map((d) => (
          <div key={d} className="border-b border-r bg-gray-50 p-1 text-center font-medium">
            {d}
          </div>
        ))}
        {weeks.flat().map((cell) => (
          <div
            key={cell.key}
            data-testid={`day-${cell.key}`}
            className={`min-h-24 border-b border-r p-1 ${cell.inMonth ? "" : "bg-gray-50 text-gray-400"} ${
              cell.key === todayKey ? "ring-2 ring-inset ring-blue-400" : ""
            }`}
          >
            <div className="mb-1 text-xs">{cell.day}</div>
            <div className="flex flex-col gap-1">
              {(byDay.get(cell.key) ?? []).map((e) =>
                isStandalone(e) ? (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setDraft({ id: e.id, kind: e.kind, title: e.title, local: e.local })}
                    className={`truncate rounded px-1 py-0.5 text-left text-xs ${STANDALONE_CLASS[e.kind]}`}
                  >
                    {e.time} {e.title}
                  </button>
                ) : (
                  <Link
                    key={e.id}
                    href={`/courses/${e.courseId}`}
                    style={{ backgroundColor: e.color ?? undefined }}
                    className="truncate rounded px-1 py-0.5 text-xs text-gray-900"
                  >
                    {e.time} {e.title}
                  </Link>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
