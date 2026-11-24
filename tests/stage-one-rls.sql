-- Run against the stage-one schema. All fixtures are rolled back.
begin;
select set_config('core_test.a', gen_random_uuid()::text, true);
select set_config('core_test.b', gen_random_uuid()::text, true);
select set_config('core_test.dataset', 'DS-TEST-' || gen_random_uuid()::text, true);
insert into auth.users (id, email) values
  (current_setting('core_test.a')::uuid, 'core-rls-a@example.invalid'),
  (current_setting('core_test.b')::uuid, 'core-rls-b@example.invalid');
insert into public.profiles (user_id, organization_id, role, is_verified)
select current_setting('core_test.a')::uuid, id, 'contributor', false from public.organizations where type = 'university' order by id limit 1;
insert into public.profiles (user_id, organization_id, role, is_verified)
select current_setting('core_test.b')::uuid, organization_id, 'management', true from public.profiles where user_id = current_setting('core_test.a')::uuid;
insert into public.datasets (id, owner_id, organization_id, title)
select current_setting('core_test.dataset'), user_id, organization_id, '{"ru":"RLS fixture"}'::jsonb from public.profiles where user_id = current_setting('core_test.a')::uuid;

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('core_test.a'),'role','authenticated')::text, true);
do $$
begin
  begin
    update public.profiles set is_verified = true where user_id = auth.uid();
    raise exception 'Self-verification was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.datasets set publication_status = 'published' where id = current_setting('core_test.dataset');
    raise exception 'Unverified publication was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.datasets set owner_id = current_setting('core_test.b')::uuid where id = current_setting('core_test.dataset');
    raise exception 'Owner transfer was allowed';
  exception when insufficient_privilege then null;
  end;
  update public.datasets set description = '{"ru":"Saved draft"}'::jsonb where id = current_setting('core_test.dataset');
  if not found then raise exception 'Own draft was not editable'; end if;
end $$;

select set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('core_test.b'),'role','authenticated')::text, true);
do $$
begin
  if exists (select 1 from public.datasets where id = current_setting('core_test.dataset')) then raise exception 'Another member could read a private draft'; end if;
  update public.datasets set description = '{"ru":"Foreign edit"}'::jsonb where id = current_setting('core_test.dataset');
  if found then raise exception 'A management role could edit another member draft'; end if;
end $$;

reset role;
update public.profiles set is_verified = true where user_id = current_setting('core_test.a')::uuid;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('core_test.a'),'role','authenticated')::text, true);
update public.datasets set publication_status = 'published' where id = current_setting('core_test.dataset');
set local role anon;
do $$ begin
  if not exists(select 1 from public.datasets where id = current_setting('core_test.dataset')) then raise exception 'Published record not public'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('core_test.b'),'role','authenticated')::text, true);
do $$ begin
  update public.datasets set description = '{"ru":"Foreign published edit"}'::jsonb where id = current_setting('core_test.dataset');
  if found then raise exception 'Another organization member could edit a published record'; end if;
end $$;
select set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('core_test.a'),'role','authenticated')::text, true);
update public.datasets set publication_status = 'unpublished' where id = current_setting('core_test.dataset');
set local role anon;
do $$ begin
  if exists(select 1 from public.datasets where id = current_setting('core_test.dataset')) then raise exception 'Unpublished record remained public'; end if;
end $$;
reset role;
select 'passed: private drafts, same-organization isolation, protected approval and owner, verified publication, anonymous visibility, unpublication' as result;
rollback;
