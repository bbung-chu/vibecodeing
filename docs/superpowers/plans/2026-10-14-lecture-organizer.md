# Lecture Organizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a laptop-first web app where a university student keeps lecture files in 학년 → 학기 → 강의 folders, a Mon–Fri timetable, and exam/assignment/contest dates with D-day.

**Architecture:** One Next.js App Router project. Pure domain logic (D-day, slot overlap, file rules) lives in `src/lib/domain` and is unit-tested in isolation. Each feature (`semesters`, `courses`, `events`, `files`) owns its server actions, queries and components under `src/features/<name>`. Supabase provides Google auth, Postgres with row-level security, and a private storage bucket; schema lives in SQL migrations.

**Tech Stack:** Next.js 15 (App Router, TypeScript, Server Actions), Tailwind CSS 4, `@supabase/ssr` + `@supabase/supabase-js`, Supabase CLI (local stack via Docker), Vitest, Playwright, ESLint. Node 22.

**Spec:** `docs/superpowers/specs/2026-10-14-lecture-organizer-design.md`

## Global Constraints

- Laptop-first layout: fixed left sidebar, content on the right; narrow screens must not break but get no dedicated design.
- Timetable is 월~금 only. `day_of_week` is 1 (월) to 5 (금). No weekend classes.
- Default timetable hours 09:00–18:00, extended to fit classes outside that range.
- All dates shown and D-day computed in `Asia/Seoul`. Same KST day = "D-day", next day = "D-1", past = "D+n".
- Home shows events from today (KST) through the next 30 days; past events hidden.
- Max file size 50MB (52,428,800 bytes). Allowed extensions (case-insensitive): pdf, ppt, pptx, doc, docx, hwp, hwpx, xls, xlsx, txt, png, jpg, jpeg, zip.
- PDF and images preview in browser; other types download. Downloads/previews use short-lived signed URLs (60 s).
- Storage path `{user_id}/{course_id}/{file_id}` in one private bucket `materials`.
- Event kinds: `midterm`, `final`, `assignment`, `contest`, `personal`. midterm/final at most one per course; midterm/final/assignment require `course_id`; contest/personal have none.
- Deleting a course or semester deletes its slots, events, file rows and storage objects, after a confirm dialog.
- Overlapping class times warn and ask; they are not blocked. Slot start must be before end.
- Google is the only production login method. Supabase URL/keys only via env vars; `.env*.local` never committed.
- UI copy is Korean.
- Out of scope: annotation, sharing, notifications, Everytime import, weekend classes.

## Review Focus

1. Korean, spaced or duplicate file names (`운영체제 1주차.pdf` uploaded twice) — both kept, each downloads under its original name. Test in Task 9.
2. Events near midnight (e.g. 2026-10-20 23:30 KST is 14:30 UTC) — D-day and the 30-day window use the KST date, not UTC. Test in Task 2.
3. Upload succeeds in storage but the DB insert fails — no orphan object left. Test in Task 9.
4. Deleting a course removes its storage objects, not just rows (DB cascade does not touch storage). Test in Task 7.
5. Upper-case or double extensions (`SLIDES.PDF`, `notes.pdf.exe`) — first allowed, second rejected (only the last extension counts). Test in Task 3.

---

## File Structure

```
.github/workflows/ci.yml          lint, typecheck, unit tests
supabase/config.toml              local stack (supabase init)
supabase/migrations/0001_init.sql tables, RLS, storage bucket + policies
src/middleware.ts                 refresh session, redirect signed-out users
src/lib/supabase/{server,client,admin}.ts
src/lib/supabase/storage.ts       removeCourseObjects
src/lib/domain/types.ts           shared domain types
src/lib/domain/dday.ts            D-day, KST date helpers, upcoming/today filters
src/lib/domain/slots.ts           slot validation, overlap, timetable range
src/lib/domain/files.ts           file validation
src/app/login/page.tsx            Google sign-in button
src/app/auth/callback/route.ts    OAuth code exchange
src/app/auth/test-login/route.ts  E2E-only password login (disabled unless E2E=1)
src/app/(app)/layout.tsx          sidebar + semester picker
src/app/(app)/page.tsx            홈
src/app/(app)/timetable/page.tsx  시간표
src/app/(app)/materials/page.tsx  자료 (tree + file list via ?course=)
src/app/(app)/courses/[id]/page.tsx 강의 (info, exams, assignments)
src/app/(app)/schedule/page.tsx   일정 (month / list)
src/features/semesters/{actions,queries}.ts, SemesterPicker.tsx
src/features/courses/{actions,queries}.ts, CourseForm.tsx, TimetableGrid.tsx
src/features/events/{actions,queries}.ts, ExamFields.tsx, AssignmentList.tsx, MonthCalendar.tsx, EventList.tsx, EventForm.tsx
src/features/files/{actions,queries}.ts, MaterialsTree.tsx, FileList.tsx, UploadButton.tsx
src/components/ConfirmDialog.tsx
tests/unit/*.test.ts              Vitest
tests/db/*.test.ts                Vitest against local Supabase
e2e/*.spec.ts                     Playwright against local Supabase
```

Shared types (`src/lib/domain/types.ts`), referenced by every task:

```ts
export type DayOfWeek = 1 | 2 | 3 | 4 | 5;
export type Slot = { courseId?: string; dayOfWeek: DayOfWeek; start: string; end: string }; // "HH:MM"
export type EventKind = 'midterm' | 'final' | 'assignment' | 'contest' | 'personal';
export type AppEvent = { id: string; courseId: string | null; kind: EventKind; title: string; startsAt: string }; // ISO UTC
export type Course = { id: string; semesterId: string; name: string; professor: string | null; room: string | null; color: string; slots: Slot[] };
export type Semester = { id: string; year: 1 | 2 | 3 | 4; term: 1 | 2 };
```

---

### Task 1: Project scaffold and CI

**Files:**
- Create: Next.js app at repo root (`package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `eslint.config.mjs`), `vitest.config.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`, `.env.example`, `src/lib/domain/types.ts`
- Modify: `.gitignore` (add `node_modules`, `.next`, `.env*.local`, `playwright-report`, `test-results`, `supabase/.temp`)
- Test: `tests/unit/smoke.test.ts`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `lint`, `typecheck` (`tsc --noEmit`), `test` (vitest run tests/unit), `test:db` (vitest run tests/db), `e2e` (playwright test); path alias `@/*` → `src/*`; the types above.

- [ ] **Step 1:** `npx create-next-app@15 . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm` (keep existing README, `.claude/`, `docs/`). Add dev deps `vitest`, `@playwright/test`. Set `<html lang="ko">`, title "강의 정리".
- [ ] **Step 2:** Write `tests/unit/smoke.test.ts` asserting `1 + 1 === 2`; run `npm test` → PASS. Run `npm run lint && npm run typecheck && npm run build` → all exit 0.
- [ ] **Step 3:** `ci.yml` on push/PR: Node 22, `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`. `.env.example` lists `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `E2E`.
- [ ] **Step 4:** Commit `chore: scaffold Next.js app with tests and CI`.

### Task 2: D-day and date filters

**Files:**
- Create: `src/lib/domain/dday.ts`
- Test: `tests/unit/dday.test.ts`

**Interfaces:**
- Produces:
  - `kstDateKey(at: Date): string` → `"YYYY-MM-DD"` in Asia/Seoul
  - `ddayCount(target: Date, now: Date): number` → KST calendar-day difference (target − now)
  - `formatDday(n: number): string` → `0` "D-day", `3` "D-3", `-2` "D+2"
  - `upcomingEvents(events: AppEvent[], now: Date, days = 30): AppEvent[]` → KST date in [today, today+days], sorted by `startsAt` asc
  - `kstWeekday(at: Date): number` → 1=월 … 7=일
  - `todayClasses(courses: Course[], now: Date): { course: Course; slot: Slot }[]` sorted by `slot.start`

- [ ] **Step 1: Write failing tests**

```ts
const now = new Date('2026-10-14T15:30:00Z'); // 2026-10-15 00:30 KST
expect(kstDateKey(now)).toBe('2026-10-15');
expect(ddayCount(new Date('2026-10-15T14:59:00Z'), now)).toBe(0);  // 23:59 KST same day
expect(ddayCount(new Date('2026-10-15T15:00:00Z'), now)).toBe(1);  // 00:00 KST next day
expect(ddayCount(new Date('2026-10-13T00:00:00Z'), now)).toBe(-2);
expect([0, 3, -2].map(formatDday)).toEqual(['D-day', 'D-3', 'D+2']);
// upcomingEvents: event at 2026-10-14T14:00Z (yesterday 23:00 KST) excluded; one at +30 KST days included; +31 excluded; output sorted
// todayClasses: now is Thursday KST (kstWeekday=4); returns only dayOfWeek 4 slots sorted by start; on Saturday returns []
```

- [ ] **Step 2:** `npx vitest run tests/unit/dday.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement with `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' })` for date keys; diff via `Date.UTC` of the two keys / 86,400,000. No date library.
- [ ] **Step 4:** Re-run → PASS. Commit `feat: add KST D-day and event filters`.

### Task 3: Slot and file rules

**Files:**
- Create: `src/lib/domain/slots.ts`, `src/lib/domain/files.ts`
- Test: `tests/unit/slots.test.ts`, `tests/unit/files.test.ts`

**Interfaces:**
- Produces:
  - `validateSlot(s: Slot): string | null` → Korean error or null
  - `findOverlaps(candidate: Slot[], existing: Slot[]): Slot[]` → existing slots that overlap any candidate (same day, `a.start < b.end && b.start < a.end`; touching ends do not overlap; existing slots with the same `courseId` as the candidate are ignored so editing a course doesn't flag itself)
  - `timetableRange(slots: Slot[]): { startHour: number; endHour: number }`
  - `MAX_FILE_BYTES = 52_428_800`, `ALLOWED_EXTENSIONS: readonly string[]`
  - `validateFile(f: { name: string; size: number }): { ok: true } | { ok: false; reason: string }`
  - `isPreviewable(name: string): boolean` (pdf, png, jpg, jpeg)

- [ ] **Step 1: Write failing tests**

```ts
expect(validateSlot({ dayOfWeek: 1, start: '12:00', end: '10:30' })).toBe('시작 시간이 끝 시간보다 빨라야 해요');
expect(validateSlot({ dayOfWeek: 6 as DayOfWeek, start: '09:00', end: '10:00' })).toBe('수업은 월요일부터 금요일까지만 넣을 수 있어요');
expect(validateSlot({ dayOfWeek: 1, start: '09:00', end: '10:30' })).toBeNull();
const ex = [{ courseId: 'a', dayOfWeek: 1, start: '10:30', end: '12:00' }];
expect(findOverlaps([{ dayOfWeek: 1, start: '11:00', end: '12:30' }], ex)).toHaveLength(1);
expect(findOverlaps([{ dayOfWeek: 1, start: '12:00', end: '13:00' }], ex)).toHaveLength(0);
expect(findOverlaps([{ dayOfWeek: 2, start: '11:00', end: '12:30' }], ex)).toHaveLength(0);
expect(findOverlaps([{ courseId: 'a', dayOfWeek: 1, start: '11:00', end: '12:00' }], ex)).toHaveLength(0);
expect(timetableRange([])).toEqual({ startHour: 9, endHour: 18 });
expect(timetableRange([{ dayOfWeek: 1, start: '08:30', end: '19:15' }])).toEqual({ startHour: 8, endHour: 20 });
expect(validateFile({ name: 'SLIDES.PDF', size: 1000 })).toEqual({ ok: true });
expect(validateFile({ name: 'notes.pdf.exe', size: 1000 }).ok).toBe(false);
expect(validateFile({ name: 'noext', size: 1000 }).ok).toBe(false);
expect(validateFile({ name: 'a.pdf', size: 52_428_800 }).ok).toBe(true);
expect(validateFile({ name: 'a.pdf', size: 52_428_801 })).toEqual({ ok: false, reason: '파일은 50MB까지 올릴 수 있어요' });
expect(validateFile({ name: 'a.exe', size: 10 })).toEqual({ ok: false, reason: '올릴 수 없는 파일 형식이에요' });
expect(isPreviewable('x.JPG')).toBe(true); expect(isPreviewable('x.pptx')).toBe(false);
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS. Commit `feat: add slot and file rules`.

### Task 4: Database schema, RLS and storage

**Files:**
- Create: `supabase/config.toml` (`npx supabase init`), `supabase/migrations/0001_init.sql`, `src/lib/supabase/admin.ts`, `src/lib/supabase/storage.ts`, `tests/db/helpers.ts`, `tests/db/rls.test.ts`

**Interfaces:**
- Produces tables (all `id uuid default gen_random_uuid() primary key`, `user_id uuid not null default auth.uid() references auth.users on delete cascade`, `created_at timestamptz default now()`):
  - `semesters(year smallint check 1..4, term smallint check 1..2, unique(user_id, year, term))`
  - `courses(semester_id → semesters on delete cascade, name text not null, professor text, room text, color text not null)`
  - `course_slots(course_id → courses on delete cascade, day_of_week smallint check 1..5, start_time time, end_time time, check start_time < end_time)` (user_id included for RLS)
  - `events(course_id → courses on delete cascade null, kind text check in (...), title text not null, starts_at timestamptz not null)`, check `(kind in ('contest','personal')) = (course_id is null)`, unique index `(course_id, kind) where kind in ('midterm','final')`
  - `files(course_id → courses on delete cascade, name text not null, size_bytes bigint, mime_type text, storage_path text not null unique)`
  - RLS on every table: `using (user_id = auth.uid()) with check (user_id = auth.uid())`; child rows also check the parent belongs to the same user (`course_id in (select id from courses where user_id = auth.uid())`).
  - Storage bucket `materials` (private, `file_size_limit` 52428800); policies on `storage.objects` for select/insert/update/delete where `bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text`.
- `createAdminClient(): SupabaseClient` (service role; tests and E2E only).
- `removeCourseObjects(client: SupabaseClient, userId: string, courseIds: string[]): Promise<void>` — lists and removes every object under `{userId}/{courseId}/` (paged by 100).
- `tests/db/helpers.ts`: `createTestUser(email: string): Promise<{ client: SupabaseClient; userId: string }>` (admin creates user with password, returns signed-in anon client).

- [ ] **Step 1: Write failing tests** in `tests/db/rls.test.ts` with users A and B:
  - B selecting A's semesters/courses/events/files returns 0 rows; B inserting a course into A's semester fails.
  - B downloading `A/<course>/<file>` from `materials` errors; B uploading to `A/...` errors.
  - Inserting a 2nd `midterm` for one course fails; inserting `contest` with a `course_id` fails; inserting slot `day_of_week = 6` fails.
  - Duplicate (year, term) for A fails; same (year, term) for B succeeds.
  - `removeCourseObjects` with 2 objects under A's course prefix leaves 0 there and leaves A's other course untouched.
- [ ] **Step 2:** `npx supabase start` then `npm run test:db` → FAIL (tables missing).
- [ ] **Step 3:** Write the migration; `npx supabase db reset`.
- [ ] **Step 4:** `npm run test:db` → PASS. Commit `feat: add database schema with RLS and storage policies`.

### Task 5: Auth and app shell

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/middleware.ts`, `src/app/login/page.tsx`, `src/app/auth/callback/route.ts`, `src/app/auth/test-login/route.ts`, `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx` (placeholder), `src/components/Sidebar.tsx`, `e2e/helpers.ts`, `e2e/auth.spec.ts`, `tests/unit/test-login.test.ts`
- Modify: `supabase/config.toml` (enable Google provider via env, keep email/password for local)

**Interfaces:**
- Produces: `createServerSupabase(): Promise<SupabaseClient>` (cookie-bound), `createBrowserSupabase(): SupabaseClient`, `requireUser(): Promise<User>` (redirects to `/login`), `e2e/helpers.ts` `login(page, email)` that hits `/auth/test-login?email=` after creating the user with the admin client.
- Sidebar links: 홈 `/`, 시간표 `/timetable`, 자료 `/materials`, 일정 `/schedule`; 로그아웃 button.
- `/auth/test-login` returns 404 unless `process.env.E2E === '1'`.

- [ ] **Step 1: Write failing E2E** `auth.spec.ts`: signed-out visit to `/timetable` lands on `/login` showing "구글로 계속하기"; after `login(page, ...)` the sidebar shows all four links; 로그아웃 returns to `/login`. Plus `tests/unit/test-login.test.ts`: importing the route's `GET` with `E2E` unset and calling it returns status 404.
- [ ] **Step 2:** `npm run e2e -- auth` → FAIL. **Step 3:** Implement with `@supabase/ssr` cookie pattern; login page calls `signInWithOAuth({ provider: 'google', options: { redirectTo: origin + '/auth/callback' } })`. **Step 4:** PASS. Commit `feat: add Google login and app shell`.

### Task 6: Semesters

**Files:**
- Create: `src/features/semesters/actions.ts`, `src/features/semesters/queries.ts`, `src/features/semesters/SemesterPicker.tsx`, `src/components/ConfirmDialog.tsx`, `e2e/semesters.spec.ts`
- Modify: `src/app/(app)/layout.tsx` (render picker at top)

**Interfaces:**
- Produces: `listSemesters(): Promise<Semester[]>` sorted by year, term; `getCurrentSemester(): Promise<Semester | null>` (cookie `semester_id`, falling back to the latest); `createSemester(year, term): Promise<{ error?: string }>` ("이미 있는 학기예요" on duplicate); `selectSemester(id): Promise<void>`; `deleteSemester(id): Promise<void>` (calls `removeCourseObjects` for all its courses, then deletes the row); `ConfirmDialog({ title, message, onConfirm })`.

- [ ] **Step 1: Failing E2E:** create "2학년 1학기" → picker shows it and it's selected; creating it again shows "이미 있는 학기예요"; create "2학년 2학기", switch, reload → selection persists; delete via confirm dialog removes it.
- [ ] **Step 2–4:** Run FAIL → implement → PASS. Commit `feat: add semester picker`.

### Task 7: Courses and timetable

**Files:**
- Create: `src/features/courses/actions.ts`, `src/features/courses/queries.ts`, `src/features/courses/CourseForm.tsx`, `src/features/courses/TimetableGrid.tsx`, `src/app/(app)/timetable/page.tsx`, `src/app/(app)/courses/[id]/page.tsx` (info section only), `e2e/timetable.spec.ts`, `tests/db/course-delete.test.ts`

**Interfaces:**
- Consumes: `validateSlot`, `findOverlaps`, `timetableRange` (Task 3); `getCurrentSemester` (Task 6); `removeCourseObjects` (Task 4).
- Produces: `listCourses(semesterId): Promise<Course[]>`; `getCourse(id): Promise<Course | null>`; `saveCourse(input: { id?: string; semesterId: string; name: string; professor?: string; room?: string; color: string; slots: Slot[]; confirmOverlap?: boolean }): Promise<{ id?: string; error?: string; overlaps?: Slot[] }>` — returns `overlaps` without saving when any exist and `confirmOverlap` is not true; `deleteCourse(id): Promise<void>` — removes storage objects first, then the row (cascade does the rest).
- Colors: fixed palette of 8 Tailwind-backed hex values, default chosen round-robin.

- [ ] **Step 1: Failing tests.** E2E: add "운영체제" Mon/Wed 10:30–12:00 → two blocks in 월/수 columns, 09–18 rows; add "자료구조" Mon 11:00–12:30 → overlap warning listing 운영체제, "그래도 저장" saves it; end before start shows "시작 시간이 끝 시간보다 빨라야 해요"; clicking a block opens `/courses/[id]`; no 토 column ever. DB test `course-delete.test.ts`: course with one uploaded object → `deleteCourse` leaves 0 rows in slots/events/files and 0 objects under its prefix.
- [ ] **Step 2–4:** FAIL → implement → PASS. Commit `feat: add courses and timetable`.

### Task 8: Exams and assignments on the course page

**Files:**
- Create: `src/features/events/actions.ts`, `src/features/events/queries.ts`, `src/features/events/ExamFields.tsx`, `src/features/events/AssignmentList.tsx`, `e2e/course-events.spec.ts`
- Modify: `src/app/(app)/courses/[id]/page.tsx`

**Interfaces:**
- Produces: `setExam(courseId: string, kind: 'midterm' | 'final', startsAt: string | null): Promise<void>` (upsert; null deletes; title auto "{강의명} 중간고사"/"기말고사"); `saveAssignment(input: { id?: string; courseId: string; title: string; startsAt: string }): Promise<{ error?: string }>`; `deleteEvent(id: string): Promise<void>`; `listEvents(range?: { from: string; to: string }): Promise<(AppEvent & { courseName: string | null; color: string | null })[]>`.
- Datetime inputs are entered as KST (`datetime-local`) and converted to UTC ISO with a `+09:00` offset.

- [ ] **Step 1: Failing E2E:** on 운영체제, set 중간고사 2026-10-20 10:00 → stored and re-shown as 10:00 after reload; change it → still one midterm; clear → removed; add two 과제 with titles and deadlines → both listed by deadline; delete one.
- [ ] **Step 2–4:** FAIL → implement → PASS. Commit `feat: add exam and assignment dates`.

### Task 9: Materials

**Files:**
- Create: `src/features/files/actions.ts`, `src/features/files/queries.ts`, `src/features/files/MaterialsTree.tsx`, `src/features/files/FileList.tsx`, `src/features/files/UploadButton.tsx`, `src/app/(app)/materials/page.tsx`, `e2e/materials.spec.ts`, `e2e/fixtures/운영체제 1주차.pdf`, `tests/db/upload-rollback.test.ts`

**Interfaces:**
- Consumes: `validateFile`, `isPreviewable` (Task 3); `listSemesters` (Task 6); `listCourses` (Task 7).
- Produces: `uploadFile(courseId: string, file: File): Promise<{ error?: string }>` — validate, generate `fileId`, upload to `{userId}/{courseId}/{fileId}`, insert row; if the insert fails, remove the object and return "업로드에 실패했어요. 다시 시도해 주세요"; `listFiles(courseId): Promise<FileRow[]>` newest first; `getFileUrl(id, mode: 'preview' | 'download'): Promise<string>` (60 s signed URL, download with original `name`); `renameFile(id, name): Promise<{ error?: string }>` (extension must stay allowed); `deleteFile(id): Promise<void>` (object, then row).
- Tree: every semester (학년 → 학기) and its courses; selecting a course sets `?course=<id>`.

- [ ] **Step 1: Failing tests.** E2E: tree shows 2학년 → 1학기 → 운영체제 created in Task 7's flow; upload the fixture twice → two rows both named `운영체제 1주차.pdf`; 미리보기 opens a PDF viewer; 다운로드 saves as `운영체제 1주차.pdf`; a 51MB generated file and `a.exe` are rejected client-side with the Task 3 messages; rename and delete work. DB test `upload-rollback.test.ts`: with a row insert forced to fail (insert into a course id the user doesn't own), `uploadFile` leaves no object under the prefix.
- [ ] **Step 2–4:** FAIL → implement → PASS. Commit `feat: add materials upload and browsing`.

### Task 10: Schedule

**Files:**
- Create: `src/features/events/MonthCalendar.tsx`, `src/features/events/EventList.tsx`, `src/features/events/EventForm.tsx`, `src/app/(app)/schedule/page.tsx`, `e2e/schedule.spec.ts`

**Interfaces:**
- Consumes: `listEvents`, `deleteEvent` (Task 8); `formatDday`, `ddayCount`, `kstDateKey` (Task 2).
- Produces: `saveStandaloneEvent(input: { id?: string; kind: 'contest' | 'personal'; title: string; startsAt: string }): Promise<{ error?: string }>` in `src/features/events/actions.ts`.
- Month view (`?view=month&month=YYYY-MM`, default current KST month) and list view (`?view=list`, upcoming first). Course events use the course color and link to `/courses/[id]`; contest/personal use fixed colors and open `EventForm`.

- [ ] **Step 1: Failing E2E:** the 중간고사 from Task 8 appears on 20 October in the course color and links to the course page; add 공모전 "캡스톤 공모전" 2026-11-03 → shows on November, editable and deletable here; list view shows D-day labels in date order.
- [ ] **Step 2–4:** FAIL → implement → PASS. Commit `feat: add schedule calendar and list`.

### Task 11: Home

**Files:**
- Modify: `src/app/(app)/page.tsx`
- Create: `src/features/home/HomeView.tsx` (client component), `e2e/home.spec.ts`

**Interfaces:**
- Consumes: `upcomingEvents`, `todayClasses`, `formatDday`, `ddayCount` (Task 2); `listEvents` (Task 8); `listCourses`, `getCurrentSemester`.

- [ ] **Step 1: Failing E2E** (use Playwright `page.clock.setFixedTime('2026-10-19T00:00:00Z')`, a Monday 09:00 KST): 오늘 수업 lists 운영체제 10:30–12:00; 다가오는 일정 shows 중간고사 "D-1" before 캡스톤 공모전; an event dated 2026-10-18 is absent; empty states read "오늘은 수업이 없어요" / "다가오는 일정이 없어요".
- [ ] **Step 2–4:** FAIL → implement: the page fetches courses and the next 31 days of events on the server and passes them to `HomeView`, which computes `todayClasses`/`upcomingEvents`/D-day with the browser's `new Date()` (so the Playwright clock applies and the KST date is right regardless of server timezone) → PASS. Commit `feat: add home dashboard`.

### Task 12: Full-flow E2E and setup guide

**Files:**
- Create: `e2e/main-flow.spec.ts`, `docs/setup.md`
- Modify: `README.md`

- [ ] **Step 1:** `main-flow.spec.ts` with a fresh user: 학기 만들기 → 강의 추가 → 자료 트리에 강의 폴더 → 파일 올리기 → 중간고사 입력 → 일정과 홈에 표시 → 강의 삭제 확인 → 폴더, 일정, 파일 모두 사라짐.
- [ ] **Step 2:** Run full suite: `npm run lint && npm run typecheck && npm test && npm run test:db && npm run e2e` → all pass.
- [ ] **Step 3:** `docs/setup.md` in Korean: local run (`npx supabase start`, `.env.local`, `npm run dev`) and deployment (create Supabase project, `npx supabase db push`, Google OAuth client and redirect URLs, Vercel env vars). README links to it.
- [ ] **Step 4:** Commit `test: add full-flow E2E and setup guide`.
