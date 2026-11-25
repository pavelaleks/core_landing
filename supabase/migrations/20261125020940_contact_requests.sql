create table public.contact_requests (
  id uuid primary key,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  contact text not null check (char_length(btrim(contact)) between 1 and 500),
  comment text not null default '' check (char_length(comment) <= 20000),
  form_variant text not null check (form_variant in ('quick', 'detailed')),
  request_type text not null default 'participation' check (request_type in ('participation', 'buyer', 'university', 'researcher', 'investor', 'med', 'bench')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 30000),
  page_url text not null check (char_length(page_url) <= 2048),
  language text not null check (language in ('en', 'ru', 'uz')),
  dataset_id text references public.datasets(id) on delete set null,
  consent boolean not null check (consent),
  consent_version text not null default '2026-11-24',
  created_at timestamptz not null default now()
);

comment on table public.contact_requests is 'Private CORE contact inbox for quick and detailed site forms. UUIDs make retries idempotent.';
alter table public.contact_requests enable row level security;
revoke all on public.contact_requests from anon, authenticated;
grant insert (id, name, contact, comment, form_variant, request_type, details, page_url, language, dataset_id, consent) on public.contact_requests to anon, authenticated;
grant all on public.contact_requests to service_role;
create policy "Visitors can submit a contact request" on public.contact_requests
  for insert to anon, authenticated with check (consent = true);
