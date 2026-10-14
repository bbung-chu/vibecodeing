"use client";

import Link from "next/link";
import { useState } from "react";
import { EventForm, type EventDraft } from "./EventForm";
import { KIND_LABEL, STANDALONE_CLASS, isStandalone, type ScheduleEvent } from "./kinds";

type Props = { calendarHref: string; events: ScheduleEvent[]; defaultLocal: string };

/** Upcoming events (today KST onward), already sorted ascending by the page. */
export function EventList({ calendarHref, events, defaultLocal }: Props) {
  const [draft, setDraft] = useState<EventDraft | null>(null);
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Link href={calendarHref} className="rounded-md px-3 py-1 text-sm hover:bg-gray-100">
          달력
        </Link>
        <span className="rounded-md bg-gray-200 px-3 py-1 text-sm">목록</span>
        <button
          type="button"
          onClick={() => setDraft({ kind: "contest", title: "", local: defaultLocal })}
          className="ml-auto rounded-md bg-blue-600 px-3 py-1 text-sm text-white"
        >
          일정 추가
        </button>
      </div>
      {draft && <EventForm key={draft.id ?? "new"} initial={draft} onClose={() => setDraft(null)} />}
      {events.length === 0 ? (
        <p className="text-gray-600">다가오는 일정이 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((e) => (
            <li key={e.id} data-testid="event-row" className="flex items-center gap-3">
              <span className="w-14 font-semibold">{e.dday}</span>
              <span className="w-40 text-gray-600">
                {e.dateKey} {e.time}
              </span>
              <span className="w-20 text-sm text-gray-600">{KIND_LABEL[e.kind]}</span>
              {isStandalone(e) ? (
                <button
                  type="button"
                  onClick={() => setDraft({ id: e.id, kind: e.kind, title: e.title, local: e.local })}
                  className={`rounded px-2 py-0.5 text-left ${STANDALONE_CLASS[e.kind]}`}
                >
                  {e.title}
                </button>
              ) : (
                <Link
                  href={`/courses/${e.courseId}`}
                  style={{ backgroundColor: e.color ?? undefined }}
                  className="rounded px-2 py-0.5 text-gray-900"
                >
                  {e.title}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
