-- Shared license selection for university and company accounts; no persisted fixtures.
begin;
select set_config('core_licenses.university', gen_random_uuid()::text, true);
select set_config('core_licenses.company', gen_random_uuid()::text, true);
select set_config('core_licenses.organization', 'ORG-LICENSE-TEST-' || gen_random_uuid()::text, true);
select set_config('core_licenses.dataset_university', 'DS-LICENSE-UNI-' || gen_random_uuid()::text, true);
select set_config('core_licenses.dataset_company', 'DS-LICENSE-COMPANY-' || gen_random_uuid()::text, true);
insert into auth.users (id, email) values
  (current_setting('core_licenses.university')::uuid, 'core-license-university@example.invalid'),
  (current_setting('core_licenses.company')::uuid, 'core-license-company@example.invalid');
insert into public.organizations (id, type, name, is_verified) values
  (current_setting('core_licenses.organization'), 'company', 'License test company', false);
insert into public.profiles (user_id, organization_id, role, is_verified)
select current_setting('core_licenses.university')::uuid, id, 'contributor', true from public.organizations where type = 'university' order by id limit 1;
insert into public.profiles (user_id, organization_id, role, is_verified) values
  (current_setting('core_licenses.company')::uuid, current_setting('core_licenses.organization'), 'contributor', true);
insert into public.datasets (id, owner_id, organization_id, title)
select current_setting('core_licenses.dataset_' || kind), p.user_id, p.organization_id, '{"ru":"License fixture"}'::jsonb
from (values ('university'), ('company')) as fixture(kind)
join public.profiles p on p.user_id = current_setting('core_licenses.' || kind)::uuid;

set local role anon;
do $$ begin
  if (select count(*) from public.licenses) <> 3 then raise exception 'Three public licenses expected'; end if;
  begin
    update public.licenses set version = 'tampered';
    raise exception 'Anonymous license edits were allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

set local role authenticated;
do $$
declare account_type text; dataset_id text; chosen text;
begin
  foreach account_type in array array['university', 'company'] loop
    perform set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('core_licenses.' || account_type),'role','authenticated')::text, true);
    dataset_id := current_setting('core_licenses.dataset_' || account_type);
    begin
      update public.licenses set version = 'tampered';
      raise exception 'Authenticated license edits were allowed';
    exception when insufficient_privilege then null;
    end;
    begin
      update public.datasets set license = 'Free text' where id = dataset_id;
      raise exception 'Free-text license edits were allowed';
    exception when insufficient_privilege then null;
    end;
    begin
      update public.datasets set license_id = 'unknown-license' where id = dataset_id;
      raise exception 'An unknown license was allowed';
    exception when foreign_key_violation then null;
    end;
    begin
      update public.datasets set publication_status = 'published' where id = dataset_id;
      raise exception 'Publication without license was allowed';
    exception when check_violation then null;
    end;
    for chosen in select id from public.licenses order by id loop
      update public.datasets set license_id = chosen, publication_status = 'published' where id = dataset_id;
      if not found then raise exception 'License % unavailable for %', chosen, account_type; end if;
      update public.datasets set publication_status = 'unpublished' where id = dataset_id;
    end loop;
    begin
      update public.datasets set license_id = 'metadata-only', links = '[{"type":"data","url":"https://example.org/data.csv"}]', publication_status = 'published' where id = dataset_id;
      raise exception 'Description-only publication exposed a data file';
    exception when check_violation then null;
    end;
    update public.datasets set license_id = 'by-agreement', links = '[{"type":"example","url":"https://example.org/research"}]', publication_status = 'published' where id = dataset_id;
    update public.datasets set license_id = 'open-cc-by-4-0', links = '[{"type":"data","url":"https://example.org/data.csv"}]' where id = dataset_id;
  end loop;
end $$;

set local role anon;
do $$ begin
  if (select count(*) from public.datasets d join public.licenses l on l.id = d.license_id where d.id in (current_setting('core_licenses.dataset_university'), current_setting('core_licenses.dataset_company')) and l.id = 'open-cc-by-4-0') <> 2 then
    raise exception 'Public license joins differ for university and company';
  end if;
end $$;
reset role;
select 'passed: shared licenses for both organization types, read-only catalog, FK, publication and data-link rules' as result;
rollback;
