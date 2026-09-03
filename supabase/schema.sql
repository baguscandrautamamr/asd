-- =============================================================================
-- ASD NFPA 72 Designer — skema Supabase
--
-- Jalankan seluruh file ini sekali di Supabase Studio → SQL Editor.
-- Aman dijalankan ulang (idempotent).
-- =============================================================================

-- ----------------------------------------------------------------- profiles --
-- Baris profil dibuat otomatis lewat trigger saat user mendaftar, supaya nama
-- dan email bisa ditampilkan di daftar kehadiran real-time tanpa perlu akses
-- ke skema auth dari sisi klien.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_hue  smallint not null default (floor(random() * 360)),
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles readable by authenticated" on public.profiles;
create policy "profiles readable by authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles updatable by owner" on public.profiles;
create policy "profiles updatable by owner"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------- projects --
create table if not exists public.projects (
  id              uuid primary key default gen_random_uuid(),
  code            text not null,
  title           text not null,
  client_name     text not null default '',
  client_contact  text not null default '',
  facility_name   text not null default '',
  location        text not null default '',
  status          text not null default 'draft'
                    check (status in ('draft', 'review', 'approved', 'as-built')),
  owner_id        uuid not null references auth.users (id) on delete cascade,
  updated_by      text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists projects_owner_idx on public.projects (owner_id, updated_at desc);

alter table public.projects enable row level security;

-- Tim kecil yang saling berbagi proyek: semua user terautentikasi boleh
-- membaca, tetapi hanya pemilik yang boleh menghapus.
drop policy if exists "projects readable by authenticated" on public.projects;
create policy "projects readable by authenticated"
  on public.projects for select to authenticated using (true);

drop policy if exists "projects insertable by owner" on public.projects;
create policy "projects insertable by owner"
  on public.projects for insert to authenticated with check (auth.uid() = owner_id);

drop policy if exists "projects updatable by authenticated" on public.projects;
create policy "projects updatable by authenticated"
  on public.projects for update to authenticated using (true) with check (true);

drop policy if exists "projects deletable by owner" on public.projects;
create policy "projects deletable by owner"
  on public.projects for delete to authenticated using (auth.uid() = owner_id);

-- ---------------------------------------------------------------- scenarios --
create table if not exists public.scenarios (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  name        text not null,
  revision    text not null default 'Rev 1.0',
  params      jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists scenarios_project_idx on public.scenarios (project_id, created_at);

alter table public.scenarios enable row level security;

drop policy if exists "scenarios readable by authenticated" on public.scenarios;
create policy "scenarios readable by authenticated"
  on public.scenarios for select to authenticated using (true);

drop policy if exists "scenarios writable by authenticated" on public.scenarios;
create policy "scenarios writable by authenticated"
  on public.scenarios for insert to authenticated with check (true);

drop policy if exists "scenarios updatable by authenticated" on public.scenarios;
create policy "scenarios updatable by authenticated"
  on public.scenarios for update to authenticated using (true) with check (true);

drop policy if exists "scenarios deletable by authenticated" on public.scenarios;
create policy "scenarios deletable by authenticated"
  on public.scenarios for delete to authenticated using (true);

-- --------------------------------------------------------------- activities --
create table if not exists public.activities (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references public.projects (id) on delete cascade,
  user_id       uuid references auth.users (id) on delete set null,
  user_name     text not null default '',
  action_key    text not null default '',
  details_key   text not null default '',
  details_vars  jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists activities_recent_idx on public.activities (created_at desc);

alter table public.activities enable row level security;

drop policy if exists "activities readable by authenticated" on public.activities;
create policy "activities readable by authenticated"
  on public.activities for select to authenticated using (true);

drop policy if exists "activities insertable by author" on public.activities;
create policy "activities insertable by author"
  on public.activities for insert to authenticated with check (auth.uid() = user_id);

-- ------------------------------------------------------------------ realtime --
-- Supaya perubahan proyek/skenario/aktivitas tersiar ke klien lain.
-- Kehadiran (siapa saja yang sedang online) memakai Realtime Presence dan tidak
-- perlu tabel.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'projects'
  ) then
    alter publication supabase_realtime add table public.projects;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'scenarios'
  ) then
    alter publication supabase_realtime add table public.scenarios;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'activities'
  ) then
    alter publication supabase_realtime add table public.activities;
  end if;
end
$$;
