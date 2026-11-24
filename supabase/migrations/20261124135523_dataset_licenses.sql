-- One shared license catalog for university and company datasets.
create table public.licenses (
  id text primary key,
  name jsonb not null check (jsonb_typeof(name) = 'object'),
  description jsonb not null check (jsonb_typeof(description) = 'object'),
  document_path text not null,
  version text not null
);

alter table public.licenses enable row level security;
revoke all on public.licenses from anon, authenticated;
grant select on public.licenses to anon, authenticated;
create policy licenses_read_public on public.licenses for select to anon, authenticated using (true);

insert into public.licenses (id, name, description, document_path, version) values
('metadata-only',
 '{"ru":"Только метаданные","en":"Metadata only","uz":"Faqat metamaʼlumotlar"}',
 '{"ru":"Публикуется описание датасета. Сами данные и образцы не предоставляются.","en":"Publish the dataset description. The data and samples are not provided.","uz":"Toʻplam tavsifi eʼlon qilinadi. Maʼlumotlar va namunalar taqdim etilmaydi."}',
 'documents/metadata-only.html', '1.2'),
('by-agreement',
 '{"ru":"Доступ по соглашению","en":"Access by agreement","uz":"Kelishuv asosida kirish"}',
 '{"ru":"Публикуется описание. Данные предоставляются получателю по отдельному соглашению с правообладателем.","en":"Publish the description. Data is provided under a separate agreement with the rights holder.","uz":"Tavsif eʼlon qilinadi. Maʼlumotlar huquq egasi bilan alohida kelishuv asosida taqdim etiladi."}',
 'documents/by-agreement.html', '1.2'),
('open-cc-by-4-0',
 '{"ru":"Открытые данные — CC BY 4.0","en":"Open data — CC BY 4.0","uz":"Ochiq maʼlumotlar — CC BY 4.0"}',
 '{"ru":"Данные можно использовать, изменять и распространять, в том числе коммерчески, с указанием авторства по CC BY 4.0.","en":"Data may be used, adapted and shared, including commercially, with attribution under CC BY 4.0.","uz":"Maʼlumotlardan CC BY 4.0 asosida muallifni koʻrsatib, jumladan tijoriy maqsadlarda foydalanish, ularni oʻzgartirish va tarqatish mumkin."}',
 'documents/open-cc-by-4-0.html', '1.2');

alter table public.datasets
  add column license_id text references public.licenses(id),
  add constraint datasets_publication_license check (
    owner_id is null or publication_status <> 'published' or license_id is not null
  ),
  add constraint datasets_publication_material_links check (
    owner_id is null or publication_status <> 'published' or license_id = 'open-cc-by-4-0'
    or not jsonb_path_exists(links, '$[*] ? (@.type == "data")')
  );

-- Source licenses on imported records are retained; users select a catalog entry.
revoke insert (license, license_url, usage_terms) on public.datasets from authenticated;
revoke update (license, license_url, usage_terms) on public.datasets from authenticated;
grant insert (license_id), update (license_id) on public.datasets to authenticated;

comment on table public.licenses is 'Shared dataset usage licenses. No organization-specific copies. Browser clients may read but cannot modify the catalog.';
comment on column public.datasets.license_id is 'Selected CORE license. Required for publication of owned datasets; imported source licenses are not reassigned.';
comment on column public.datasets.license is 'Original license of imported material. Not a free-text license input for user datasets.';
