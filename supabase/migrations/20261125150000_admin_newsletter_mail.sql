-- Admin panel, newsletter subscription and email notifications to the CORE team.
-- Existing grants and policies stay untouched: admins work only through two
-- security definer functions that check public.is_admin() first.

create extension if not exists pg_net with schema extensions;

-- 1. Newsletter -------------------------------------------------------------
create table public.newsletter_subscribers (
  email text primary key check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  language text not null default 'ru' check (language in ('en', 'ru', 'uz')),
  page_url text check (char_length(page_url) <= 2048),
  created_at timestamptz not null default now()
);
alter table public.newsletter_subscribers enable row level security;
revoke all on public.newsletter_subscribers from anon, authenticated;
grant insert (email, language, page_url) on public.newsletter_subscribers to anon, authenticated;
grant all on public.newsletter_subscribers to service_role;
create policy "Visitors can subscribe" on public.newsletter_subscribers
  for insert to anon, authenticated with check (true);

-- 2. Request processing status ---------------------------------------------
alter table public.contact_requests
  add column status text not null default 'new' check (status in ('new', 'in_progress', 'done')),
  add column admin_note text not null default '' check (char_length(admin_note) <= 20000);

-- 3. Admins ------------------------------------------------------------------
-- Add an admin in the SQL editor:
--   insert into public.admins (user_id) select id from auth.users where email = 'name@coredata.uz';
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;
grant all on public.admins to service_role;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create function public.admin_list(section text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  case section
  when 'requests' then
    select jsonb_agg(to_jsonb(r) order by r.created_at desc) into result from public.contact_requests r;
  when 'subscribers' then
    select jsonb_agg(to_jsonb(s) order by s.created_at desc) into result from public.newsletter_subscribers s;
  when 'users' then
    select jsonb_agg(coalesce(to_jsonb(p), '{}'::jsonb) || jsonb_build_object(
        'user_id', u.id, 'email', u.email, 'registered_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
        'has_profile', p.user_id is not null, 'organization_name', o.name,
        'is_admin', exists (select 1 from public.admins a where a.user_id = u.id))
      order by u.created_at desc) into result
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    left join public.organizations o on o.id = p.organization_id;
  when 'organizations' then
    select jsonb_agg(to_jsonb(o) || jsonb_build_object(
        'users', (select count(*) from public.profiles p where p.organization_id = o.id),
        'datasets', (select count(*) from public.datasets d where d.organization_id = o.id))
      order by o.created_at desc, o.name) into result
    from public.organizations o;
  when 'datasets' then
    select jsonb_agg(jsonb_build_object(
        'id', d.id, 'title', d.title, 'description', d.description, 'category', d.category, 'kind', d.kind,
        'organization_id', d.organization_id, 'organization_name', o.name, 'owner_email', u.email,
        'publication_status', d.publication_status, 'access_type', d.access_type, 'license_id', d.license_id,
        'record_count', d.record_count, 'created_at', d.created_at, 'updated_at', d.updated_at)
      order by d.updated_at desc) into result
    from public.datasets d
    left join public.organizations o on o.id = d.organization_id
    left join auth.users u on u.id = d.owner_id;
  else
    raise exception 'Unknown section %', section using errcode = '22023';
  end case;
  return coalesce(result, '[]'::jsonb);
end;
$$;

-- Updates only the whitelisted columns of one row: patch is {"column": value}.
create function public.admin_update(section text, row_id text, patch jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  target text; pk text; allowed text[]; columns text; source_columns text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  select v.target, v.pk, v.allowed into target, pk, allowed from (values
    ('requests', 'contact_requests', 'id', array['status', 'admin_note']),
    ('users', 'profiles', 'user_id', array['name', 'role', 'organization_id', 'is_verified']),
    ('organizations', 'organizations', 'id', array['name', 'name_ru', 'name_en', 'name_uz', 'type', 'country', 'website', 'is_verified']),
    ('datasets', 'datasets', 'id', array['title', 'description', 'category', 'organization_id', 'publication_status', 'access_type', 'license_id'])
  ) as v(section, target, pk, allowed) where v.section = admin_update.section;
  if target is null then
    raise exception 'Unknown section %', section using errcode = '22023';
  end if;
  select string_agg(format('%I', key), ', '), string_agg(format('r.%I', key), ', ')
    into columns, source_columns
    from jsonb_object_keys(patch) as key where key = any(allowed);
  if columns is null then return; end if;
  execute format('update public.%I as t set (%s) = (select %s from jsonb_populate_record(t, $1) as r)%s where t.%I::text = $2',
    target, columns, source_columns, case when target = 'datasets' then ', updated_at = now()' else '' end, pk)
    using patch, row_id;
end;
$$;

revoke all on function public.admin_list(text), public.admin_update(text, text, jsonb) from public, anon;
grant execute on function public.admin_list(text), public.admin_update(text, text, jsonb) to authenticated;

-- 4. Email notifications to the team (Resend API) ---------------------------
-- Activated by three Vault secrets, see supabase/README.md:
--   resend_api_key, admin_email (comma separated), mail_from (optional).
-- Without them nothing is sent; a mail failure never blocks the user's action.
create function public.notify_admin(subject text, body text) returns void
language plpgsql security definer set search_path = '' as $$
declare api_key text; recipients text; sender text;
begin
  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'resend_api_key';
  select decrypted_secret into recipients from vault.decrypted_secrets where name = 'admin_email';
  select decrypted_secret into sender from vault.decrypted_secrets where name = 'mail_from';
  if api_key is null or recipients is null then return; end if;
  perform net.http_post(
    url := 'https://api.resend.com/emails',
    body := jsonb_build_object('from', coalesce(sender, 'CORE <noreply@coredata.uz>'),
      'to', string_to_array(replace(recipients, ' ', ''), ','), 'subject', subject, 'text', body),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || api_key));
exception when others then
  raise warning 'notify_admin failed: %', sqlerrm;
end;
$$;
revoke all on function public.notify_admin(text, text) from public, anon, authenticated;

create function public.notify_new_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_admin('CORE: новая регистрация',
    'Email: ' || coalesce((select email from auth.users where id = new.user_id), '') ||
    E'\nИмя: ' || new.name ||
    E'\nОрганизация: ' || coalesce((select name from public.organizations where id = new.organization_id), new.organization_id) ||
    E'\nРоль: ' || new.role ||
    E'\n\nПодтвердить пользователя: https://coredata.uz/app/admin.html#users');
  return new;
end;
$$;

create function public.notify_new_request() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_admin('CORE: новая заявка',
    'Имя: ' || new.name || E'\nКонтакт: ' || new.contact || E'\nТип: ' || new.request_type ||
    E'\nКомментарий: ' || new.comment || E'\nСтраница: ' || new.page_url ||
    E'\n\nВсе заявки: https://coredata.uz/app/admin.html#requests');
  return new;
end;
$$;

create function public.notify_new_subscriber() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_admin('CORE: новая подписка на новости', 'Email: ' || new.email || E'\nЯзык: ' || new.language);
  return new;
end;
$$;

revoke all on function public.notify_new_profile(), public.notify_new_request(), public.notify_new_subscriber() from public, anon, authenticated;

create trigger profiles_notify_admin after insert on public.profiles
  for each row execute function public.notify_new_profile();
create trigger contact_requests_notify_admin after insert on public.contact_requests
  for each row execute function public.notify_new_request();
create trigger newsletter_notify_admin after insert on public.newsletter_subscribers
  for each row execute function public.notify_new_subscriber();
