alter table public.files
  add constraint files_version_id_key unique (version_id);

alter table public.review_results
  add constraint review_results_version_id_key unique (version_id);

alter table public.review_corrections
  alter column rubric_item_id drop not null,
  add column check_key text;

alter table public.review_corrections
  add constraint review_corrections_check_target check (rubric_item_id is not null or check_key is not null);

alter table public.review_corrections
  add constraint review_corrections_result_check_key_key unique (review_result_id, check_key);

create or replace function public.create_submission_version(
  target_assignment uuid,
  target_student uuid,
  actor uuid,
  actor_is_teacher boolean default false
)
returns table(submission_id uuid, version_id uuid, version_no integer)
language plpgsql
security definer
set search_path=public
as $$
declare
  current_submission public.submissions;
  next_version integer;
  new_version uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(target_assignment::text || ':' || target_student::text, 0));

  select * into current_submission
  from public.submissions
  where assignment_id=target_assignment and student_id=target_student
  for update;

  if current_submission.id is null then
    insert into public.submissions (assignment_id,student_id,status,current_version)
    values (target_assignment,target_student,'pending_teacher_review',1)
    returning * into current_submission;
    next_version := 1;
  else
    next_version := current_submission.current_version + 1;
    update public.submissions
      set current_version=next_version,
          status='pending_teacher_review',
          returned_reason=null,
          updated_at=now()
      where id=current_submission.id;
  end if;

  insert into public.submission_versions (submission_id,version_no,submitted_by,submitted_by_teacher)
  values (current_submission.id,next_version,actor,actor_is_teacher)
  returning id into new_version;

  return query select current_submission.id,new_version,next_version;
end;
$$;

revoke all on function public.create_submission_version(uuid,uuid,uuid,boolean) from public;
grant execute on function public.create_submission_version(uuid,uuid,uuid,boolean) to service_role;

drop policy if exists "owners read map files" on storage.objects;

create policy "owners read map files" on storage.objects for select to authenticated
using (
  bucket_id='map-submissions'
  and (
    (storage.foldername(name))[1]=auth.uid()::text
    or public.current_role()='admin'
    or exists(
      select 1
      from public.class_members m
      join public.classes c on c.id=m.class_id
      where m.student_id::text=(storage.foldername(name))[1]
        and c.teacher_id=auth.uid()
    )
  )
);

create policy "owners update map files" on storage.objects for update to authenticated
using (
  bucket_id='map-submissions'
  and (
    (storage.foldername(name))[1]=auth.uid()::text
    or public.current_role()='admin'
    or exists(
      select 1 from public.class_members m join public.classes c on c.id=m.class_id
      where m.student_id::text=(storage.foldername(name))[1] and c.teacher_id=auth.uid()
    )
  )
)
with check (
  bucket_id='map-submissions'
  and (
    (storage.foldername(name))[1]=auth.uid()::text
    or public.current_role()='admin'
    or exists(
      select 1 from public.class_members m join public.classes c on c.id=m.class_id
      where m.student_id::text=(storage.foldername(name))[1] and c.teacher_id=auth.uid()
    )
  )
);
