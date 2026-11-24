-- Stage one: five application tables. Auth owns identities and passwords.
create table public.organizations (
  id text primary key default ('ORG-' || gen_random_uuid()::text),
  type text not null check (type in ('university', 'company')),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  name_ru text,
  name_en text,
  name_uz text,
  country text,
  website text,
  external_ids jsonb not null default '{}'::jsonb,
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '' check (char_length(name) <= 120),
  organization_id text not null references public.organizations(id),
  role text not null default 'contributor' check (role in ('contributor', 'coordinator', 'management')),
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index profiles_organization_id_idx on public.profiles(organization_id);

create table public.datasets (
  id text primary key default ('DS-' || gen_random_uuid()::text),
  owner_id uuid references auth.users(id) on delete set null,
  organization_id text references public.organizations(id),
  kind text not null default 'dataset' check (kind in ('dataset', 'base', 'prep', 'open', 'layer')),
  title jsonb not null check (jsonb_typeof(title) = 'object' and title <> '{}'::jsonb),
  description jsonb not null default '{}'::jsonb check (jsonb_typeof(description) = 'object'),
  category text not null default '',
  countries text[] not null default '{}',
  languages text[] not null default '{}',
  license text not null default '',
  license_url text,
  usage_terms jsonb not null default '{}'::jsonb check (jsonb_typeof(usage_terms) = 'object'),
  links jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array'),
  record_count bigint check (record_count >= 0),
  token_count bigint check (token_count >= 0),
  tokenizer text,
  token_method text check (token_method in ('calculated', 'estimated', 'declared')),
  token_material text,
  data_version text,
  publication_status text not null default 'draft' check (publication_status in ('draft', 'published', 'unpublished')),
  access_type text not null default 'request' check (access_type in ('request', 'buy', 'demo', 'open')),
  source_url text,
  formats text,
  publication_year integer,
  mentions_central_asia boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (token_count is null or (nullif(btrim(tokenizer), '') is not null and token_method is not null and nullif(btrim(token_material), '') is not null and nullif(btrim(data_version), '') is not null))
);
create index datasets_owner_id_idx on public.datasets(owner_id);
create index datasets_organization_id_idx on public.datasets(organization_id);
create index datasets_publication_status_idx on public.datasets(publication_status);

create table public.consumers (
  id text primary key default ('CON-' || gen_random_uuid()::text),
  name jsonb not null check (jsonb_typeof(name) = 'object' and name <> '{}'::jsonb),
  type text not null check (type in ('research', 'digest', 'catalog', 'analytics', 'application', 'model', 'agent')),
  organization_id text references public.organizations(id),
  description jsonb not null default '{}'::jsonb,
  url text,
  is_demo boolean not null default false
);
create index consumers_organization_id_idx on public.consumers(organization_id);

create table public.dataset_usage (
  dataset_id text not null references public.datasets(id) on delete cascade,
  consumer_id text not null references public.consumers(id) on delete cascade,
  usage_scope text not null check (usage_scope in ('metadata', 'data')),
  purpose jsonb not null default '{}'::jsonb,
  result_url text,
  is_demo boolean not null default false,
  primary key (dataset_id, consumer_id, usage_scope)
);
create index dataset_usage_consumer_id_idx on public.dataset_usage(consumer_id);

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.datasets enable row level security;
alter table public.consumers enable row level security;
alter table public.dataset_usage enable row level security;

-- Remove broad project defaults before granting the exact browser operations.
revoke all on public.organizations, public.profiles, public.datasets, public.consumers, public.dataset_usage from anon, authenticated;
grant all on public.organizations, public.profiles, public.datasets, public.consumers, public.dataset_usage to service_role;
grant usage on schema public to anon, authenticated;
grant select on public.organizations, public.datasets, public.consumers, public.dataset_usage to anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (type, name) on public.organizations to authenticated;
grant insert (user_id, name, organization_id, role) on public.profiles to authenticated;
grant update (name, role) on public.profiles to authenticated;
grant insert (owner_id, organization_id, title, description, category, countries, languages, license, license_url, usage_terms, links, record_count, token_count, tokenizer, token_method, token_material, data_version) on public.datasets to authenticated;
grant update (title, description, category, countries, languages, license, license_url, usage_terms, links, record_count, token_count, tokenizer, token_method, token_material, data_version, publication_status, updated_at) on public.datasets to authenticated;

create policy organizations_read on public.organizations for select to anon, authenticated using (true);
create policy organizations_create_company on public.organizations for insert to authenticated
  with check ((select auth.uid()) is not null and type = 'company' and not is_verified);

create policy profiles_read_own on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy profiles_create_own on public.profiles for insert to authenticated
  with check (user_id = (select auth.uid()) and not is_verified);
create policy profiles_update_own on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy datasets_read_public on public.datasets for select to anon, authenticated
  using (publication_status = 'published');
create policy datasets_read_own on public.datasets for select to authenticated
  using (owner_id = (select auth.uid()));
create policy datasets_create_own_draft on public.datasets for insert to authenticated
  with check (owner_id = (select auth.uid()) and publication_status = 'draft' and kind = 'dataset'
    and organization_id = (select p.organization_id from public.profiles p where p.user_id = (select auth.uid())));
create policy datasets_update_own on public.datasets for update to authenticated
  using (owner_id = (select auth.uid()) and (publication_status <> 'published' or exists (
    select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.organization_id = datasets.organization_id and p.is_verified
  )))
  with check (owner_id = (select auth.uid())
    and organization_id = (select p.organization_id from public.profiles p where p.user_id = (select auth.uid()))
    and (publication_status <> 'published' or exists (
      select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.organization_id = datasets.organization_id and p.is_verified
    )));

create policy dataset_usage_read_public on public.dataset_usage for select to anon, authenticated
  using (exists (select 1 from public.datasets d where d.id = dataset_usage.dataset_id and d.publication_status = 'published'));
create policy consumers_read_public on public.consumers for select to anon, authenticated
  using (exists (select 1 from public.dataset_usage u join public.datasets d on d.id = u.dataset_id
    where u.consumer_id = consumers.id and d.publication_status = 'published'));

-- Verification is a staff action in the Supabase dashboard, never a form role.
comment on column public.profiles.is_verified is 'Demo approval by CORE. Browser users cannot set this field.';
comment on column public.organizations.is_verified is 'Separate organization badge; imported university records are verified in the demo.';
comment on column public.profiles.role is 'Descriptive role inside an organization, grants no CORE administration rights.';
