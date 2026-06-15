create extension if not exists "pgcrypto";
create type public.app_role as enum ('admin','teacher','student');
create type public.assignment_status as enum ('draft','published','closed','archived');
create type public.submission_status as enum ('ai_processing','ai_failed','pending_teacher_review','returned','reviewed','graded');
create type public.ai_job_status as enum ('queued','processing','completed','failed','partial');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'student',
  student_no text unique,
  display_name text not null,
  must_change_password boolean not null default true,
  disabled_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id),
  name text not null,
  term text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.class_members (
  class_id uuid references public.classes(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id,student_id)
);
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id),
  title text not null,
  description text not null default '',
  status public.assignment_status not null default 'draft',
  publish_at timestamptz,
  deadline timestamptz not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.rubric_items (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  title text not null,
  description text not null default '',
  weight numeric(5,2) not null check (weight > 0 and weight <= 100),
  sort_order integer not null default 0
);
create table public.extensions (
  assignment_id uuid references public.assignments(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,
  extended_deadline timestamptz not null,
  reason text not null default '',
  primary key (assignment_id,student_id)
);
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id),
  student_id uuid not null references public.profiles(id),
  status public.submission_status not null default 'ai_processing',
  current_version integer not null default 1,
  teacher_feedback text,
  returned_reason text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id,student_id)
);
create table public.submission_versions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id),
  version_no integer not null,
  submitted_by uuid not null references public.profiles(id),
  submitted_by_teacher boolean not null default false,
  created_at timestamptz not null default now(),
  unique (submission_id,version_no)
);
create table public.files (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.submission_versions(id),
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  preview_paths text[] not null default '{}',
  created_at timestamptz not null default now()
);
create table public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  model text not null,
  external_job_id text,
  status public.ai_job_status not null default 'queued',
  requested_by uuid references public.profiles(id),
  version_id uuid references public.submission_versions(id),
  item_count integer not null default 1,
  completed_count integer not null default 0,
  error_message text,
  duration_ms integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.review_results (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.submission_versions(id),
  ai_job_id uuid references public.ai_jobs(id),
  raw_result jsonb not null,
  overall_suggestion text not null,
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  visible_to_student boolean not null default false,
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.review_corrections (
  id uuid primary key default gen_random_uuid(),
  review_result_id uuid not null references public.review_results(id),
  rubric_item_id uuid not null references public.rubric_items(id),
  ai_value jsonb not null,
  teacher_value jsonb not null,
  corrected_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.grades (
  submission_id uuid primary key references public.submissions(id),
  final_score numeric(5,2) not null check (final_score between 0 and 100),
  feedback text not null default '',
  published_at timestamptz,
  published_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.assignments enable row level security;
alter table public.rubric_items enable row level security;
alter table public.extensions enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_versions enable row level security;
alter table public.files enable row level security;
alter table public.ai_jobs enable row level security;
alter table public.review_results enable row level security;
alter table public.review_corrections enable row level security;
alter table public.grades enable row level security;
alter table public.audit_logs enable row level security;

create function public.current_role() returns public.app_role language sql stable security definer set search_path=public as $$ select role from public.profiles where id=auth.uid() $$;
create function public.owns_class(target uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.classes where id=target and teacher_id=auth.uid()) $$;
create function public.in_class(target uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.class_members where class_id=target and student_id=auth.uid()) $$;

create policy "profiles self teacher or admin read" on public.profiles for select using (id=auth.uid() or public.current_role()='admin' or exists(select 1 from public.class_members m join public.classes c on c.id=m.class_id where m.student_id=profiles.id and c.teacher_id=auth.uid()));
create policy "classes role read" on public.classes for select using (teacher_id=auth.uid() or public.in_class(id) or public.current_role()='admin');
create policy "teacher manages classes" on public.classes for all using (teacher_id=auth.uid() or public.current_role()='admin') with check (teacher_id=auth.uid() or public.current_role()='admin');
create policy "members role read" on public.class_members for select using (student_id=auth.uid() or public.owns_class(class_id) or public.current_role()='admin');
create policy "teacher manages members" on public.class_members for all using (public.owns_class(class_id) or public.current_role()='admin') with check (public.owns_class(class_id) or public.current_role()='admin');
create policy "assignments role read" on public.assignments for select using (public.owns_class(class_id) or (public.in_class(class_id) and status<>'draft') or public.current_role()='admin');
create policy "teacher manages assignments" on public.assignments for all using (public.owns_class(class_id) or public.current_role()='admin') with check (public.owns_class(class_id) or public.current_role()='admin');
create policy "rubric role read" on public.rubric_items for select using (exists(select 1 from public.assignments a where a.id=assignment_id and (public.owns_class(a.class_id) or public.in_class(a.class_id) or public.current_role()='admin')));
create policy "teacher manages rubric" on public.rubric_items for all using (exists(select 1 from public.assignments a where a.id=assignment_id and (public.owns_class(a.class_id) or public.current_role()='admin')));
create policy "extensions relevant read" on public.extensions for select using (student_id=auth.uid() or exists(select 1 from public.assignments a where a.id=assignment_id and public.owns_class(a.class_id)) or public.current_role()='admin');
create policy "teacher manages extensions" on public.extensions for all using (exists(select 1 from public.assignments a where a.id=assignment_id and (public.owns_class(a.class_id) or public.current_role()='admin')));
create policy "submissions relevant read" on public.submissions for select using (student_id=auth.uid() or exists(select 1 from public.assignments a where a.id=assignment_id and public.owns_class(a.class_id)) or public.current_role()='admin');
create policy "students create own submissions" on public.submissions for insert with check (student_id=auth.uid() and exists(select 1 from public.assignments a where a.id=assignment_id and public.in_class(a.class_id)));
create policy "teacher updates submissions" on public.submissions for update using (student_id=auth.uid() or exists(select 1 from public.assignments a where a.id=assignment_id and public.owns_class(a.class_id)) or public.current_role()='admin');
create policy "versions relevant read" on public.submission_versions for select using (exists(select 1 from public.submissions s join public.assignments a on a.id=s.assignment_id where s.id=submission_id and (s.student_id=auth.uid() or public.owns_class(a.class_id) or public.current_role()='admin')));
create policy "versions relevant insert" on public.submission_versions for insert with check (submitted_by=auth.uid() and exists(select 1 from public.submissions s join public.assignments a on a.id=s.assignment_id where s.id=submission_id and (s.student_id=auth.uid() or public.owns_class(a.class_id))));
create policy "files relevant read" on public.files for select using (exists(select 1 from public.submission_versions v join public.submissions s on s.id=v.submission_id join public.assignments a on a.id=s.assignment_id where v.id=version_id and (s.student_id=auth.uid() or public.owns_class(a.class_id) or public.current_role()='admin')));
create policy "files relevant insert" on public.files for insert with check (exists(select 1 from public.submission_versions v join public.submissions s on s.id=v.submission_id join public.assignments a on a.id=s.assignment_id where v.id=version_id and (s.student_id=auth.uid() or public.owns_class(a.class_id))));
create policy "reviews relevant read" on public.review_results for select using (exists(select 1 from public.submission_versions v join public.submissions s on s.id=v.submission_id join public.assignments a on a.id=s.assignment_id where v.id=version_id and ((s.student_id=auth.uid() and visible_to_student) or public.owns_class(a.class_id) or public.current_role()='admin')));
create policy "teacher manages reviews" on public.review_results for all using (exists(select 1 from public.submission_versions v join public.submissions s on s.id=v.submission_id join public.assignments a on a.id=s.assignment_id where v.id=version_id and (public.owns_class(a.class_id) or public.current_role()='admin')));
create policy "corrections relevant read" on public.review_corrections for select using (exists(select 1 from public.review_results r join public.submission_versions v on v.id=r.version_id join public.submissions s on s.id=v.submission_id join public.assignments a on a.id=s.assignment_id where r.id=review_result_id and ((s.student_id=auth.uid() and r.visible_to_student) or public.owns_class(a.class_id) or public.current_role()='admin')));
create policy "teacher manages corrections" on public.review_corrections for all using (exists(select 1 from public.review_results r join public.submission_versions v on v.id=r.version_id join public.submissions s on s.id=v.submission_id join public.assignments a on a.id=s.assignment_id where r.id=review_result_id and (public.owns_class(a.class_id) or public.current_role()='admin')));
create policy "grades relevant read" on public.grades for select using (exists(select 1 from public.submissions s join public.assignments a on a.id=s.assignment_id where s.id=submission_id and ((s.student_id=auth.uid() and published_at is not null) or public.owns_class(a.class_id) or public.current_role()='admin')));
create policy "teacher manages grades" on public.grades for all using (exists(select 1 from public.submissions s join public.assignments a on a.id=s.assignment_id where s.id=submission_id and (public.owns_class(a.class_id) or public.current_role()='admin')));
create policy "admins read jobs logs" on public.ai_jobs for select using (requested_by=auth.uid() or public.current_role()='admin');
create policy "admins read audit logs" on public.audit_logs for select using (public.current_role()='admin');

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('map-submissions','map-submissions',false,52428800,array['image/png','image/jpeg','application/pdf']) on conflict (id) do nothing;
create policy "authenticated upload map files" on storage.objects for insert to authenticated with check (bucket_id='map-submissions' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "owners read map files" on storage.objects for select to authenticated using (bucket_id='map-submissions' and ((storage.foldername(name))[1]=auth.uid()::text or public.current_role() in ('teacher','admin')));
