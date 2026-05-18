-- Watchlists: saved dashboard filter views per user.
-- A watchlist captures the filter shape used in /dashboard so a user can recall
-- "everything I care about" and (Phase 1 follow-up) be emailed changes that
-- match those filters.

create table if not exists watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  iso text,
  fuel_type text,
  phase text,
  mw_bucket text,
  owner_company text,
  notify_email boolean not null default false,
  last_emailed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists watchlists_user_idx on watchlists (user_id, created_at desc);
create index if not exists watchlists_notify_idx on watchlists (notify_email) where notify_email = true;

-- Explicit per-project pins ("star this row") layered on top of filter watchlists.
create table if not exists watchlist_projects (
  watchlist_id uuid not null references watchlists(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (watchlist_id, project_id)
);

create index if not exists watchlist_projects_project_idx on watchlist_projects (project_id);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'ingestion_user') then
    grant select, insert, update, delete on watchlists, watchlist_projects to ingestion_user;
  end if;
end $$;
