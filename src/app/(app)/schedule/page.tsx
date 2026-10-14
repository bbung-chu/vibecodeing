import { EventList } from "@/features/events/EventList";
import { MonthCalendar } from "@/features/events/MonthCalendar";
import { listEvents } from "@/features/events/queries";
import type { ScheduleEvent } from "@/features/events/kinds";
import { monthWeeks, parseMonth, shiftMonth } from "@/features/events/month";
import { ddayCount, formatDday, kstDateKey } from "@/lib/domain/dday";
import { kstLocalToUtcIso, utcIsoToKstLocal } from "@/lib/domain/kst";

const DAY_MS = 86_400_000;

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string }>;
}) {
  const { view, month } = await searchParams;
  const now = new Date();
  const todayKey = kstDateKey(now);
  const defaultLocal = `${todayKey}T09:00`;

  const toEvent = (e: Awaited<ReturnType<typeof listEvents>>[number]): ScheduleEvent => {
    const local = utcIsoToKstLocal(e.startsAt);
    return {
      id: e.id,
      kind: e.kind,
      title: e.title,
      courseId: e.courseId,
      color: e.color,
      dateKey: local.slice(0, 10),
      time: local.slice(11),
      local,
      dday: formatDday(ddayCount(new Date(e.startsAt), now)),
    };
  };

  if (view === "list") {
    const from = kstLocalToUtcIso(`${todayKey}T00:00`);
    const to = new Date(Date.now() + 5 * 366 * DAY_MS).toISOString();
    const events = (await listEvents({ from, to })).map(toEvent);
    return (
      <div>
        <h1 className="mb-4 text-2xl font-bold">일정</h1>
        <EventList calendarHref="/schedule?view=month" events={events} defaultLocal={defaultLocal} />
      </div>
    );
  }

  const parsed = parseMonth(month) ?? parseMonth(todayKey.slice(0, 7))!;
  const { year, month: mon } = parsed;
  const weeks = monthWeeks(year, mon);
  const firstKey = weeks[0][0].key;
  const lastKey = weeks.at(-1)![6].key;
  const from = kstLocalToUtcIso(`${firstKey}T00:00`);
  const to = new Date(Date.parse(kstLocalToUtcIso(`${lastKey}T00:00`)) + DAY_MS - 1).toISOString();
  const events = (await listEvents({ from, to })).map(toEvent);
  const href = (m: string) => `/schedule?view=month&month=${m}`;
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">일정</h1>
      <MonthCalendar
        title={`${year}년 ${mon}월`}
        prevHref={href(shiftMonth(year, mon, -1))}
        nextHref={href(shiftMonth(year, mon, 1))}
        listHref="/schedule?view=list"
        weeks={weeks}
        events={events}
        todayKey={todayKey}
        defaultLocal={defaultLocal}
      />
    </div>
  );
}
