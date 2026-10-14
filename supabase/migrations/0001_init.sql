-- Lecture organizer schema. Every row is owned by a user; RLS makes that ownership
-- the only access path. Child rows must also hang off a parent the same user owns.

create table public.semesters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz default now(),
  year smallint not null check (year between 1 and 4),
  term smallint not null check (term between 1 and 2),
  unique (user_id, year, term)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz default now(),
  semester_id uuid not null references public.semesters on delete cascade,
  name text not null,
  professor text,
  room text,
  color text not null
);

create table public.course_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz default now(),
  course_id uuid not null references public.courses on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 5),
  start_time time not null,
  end_time time not null,
  check (start_time < end_time)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz default now(),
  course_id uuid references public.courses on delete cascade,
  kind text not null check (kind in ('midterm', 'final', 'assignment', 'contest', 'personal')),
  title text not null,
  starts_at timestamptz not null,
  check ((kind in ('contest', 'personal')) = (course_id is null))
);

create unique index events_one_exam_per_course
  on public.events (course_id, kind) where kind in ('midterm', 'final');

create table public.files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz default now(),
  course_id uuid not null references public.courses on delete cascade,
  name text not null,
  size_bytes bigint check (size_bytes is null or size_bytes <= 52428800),
  mime_type text,
  storage_path text not null unique,
  -- the object must live under the owner's own folder: {user_id}/{course_id}/...
  check (storage_path like user_id::text || '/' || course_id::text || '/%')
);

create index courses_semester_id_idx on public.courses (semester_id);
create index course_slots_course_id_idx on public.course_slots (course_id);
create index events_course_id_idx on public.events (course_id);
create index files_course_id_idx on public.files (course_id);

-- Row level security -------------------------------------------------------

alter table public.semesters enable row level security;
alter table public.courses enable row level security;
alter table public.course_slots enable row level security;
alter table public.events enable row level security;
alter table public.files enable row level security;

create policy semesters_owner on public.semesters
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy courses_owner on public.courses
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and semester_id in (select id from public.semesters where user_id = (select auth.uid()))
  );

create policy course_slots_owner on public.course_slots
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and course_id in (select id from public.courses where user_id = (select auth.uid()))
  );

create policy events_owner on public.events
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      course_id is null
      or course_id in (select id from public.courses where user_id = (select auth.uid()))
    )
  );

create policy files_owner on public.files
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and course_id in (select id from public.courses where user_id = (select auth.uid()))
  );

-- Storage -------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('materials', 'materials', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

create policy materials_select on storage.objects
  for select to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy materials_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'materials' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy materials_update on storage.objects
  for update to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'materials' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy materials_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = (select auth.uid())::text);
