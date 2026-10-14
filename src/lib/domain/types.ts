export type DayOfWeek = 1 | 2 | 3 | 4 | 5;
export type Slot = { courseId?: string; dayOfWeek: DayOfWeek; start: string; end: string }; // "HH:MM"
export type EventKind = 'midterm' | 'final' | 'assignment' | 'contest' | 'personal';
export type AppEvent = { id: string; courseId: string | null; kind: EventKind; title: string; startsAt: string }; // ISO UTC
export type Course = { id: string; semesterId: string; name: string; professor: string | null; room: string | null; color: string; slots: Slot[] };
export type Semester = { id: string; year: 1 | 2 | 3 | 4; term: 1 | 2 };
