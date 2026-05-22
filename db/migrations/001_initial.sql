create extension if not exists postgis;
create extension if not exists pgcrypto;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  iso text not null,
  queue_id text not null,
  project_name text,
  mw_requested numeric,
  fuel_type text,
  county text,
  state text,
  lat numeric,
  lng numeric,
  geom geometry(Point, 4326),
  location_source text,
  location_confidence text,
  address text,
  point_of_interconnection text,
  location_notes text,
  current_phase text,
  current_status text,
  filed_date date,
  ia_signed_date date,
  energized_date date,
  withdrawn_date date,
  owner_company text,
  raw_source_url text,
  first_seen_at timestamptz not null default now(),
  last_updated_at timestamptz not null default now(),
  unique (iso, queue_id)
);

create index if not exists projects_geom_idx on projects using gist (geom);
create index if not exists projects_phase_idx on projects (current_phase);
create index if not exists projects_fuel_type_idx on projects (fuel_type);

create table if not exists project_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  snapshot_date date not null,
  raw_data jsonb not null,
  current_phase text,
  current_status text,
  mw_requested numeric,
  captured_at timestamptz not null default now()
);

create index if not exists project_snapshots_project_date_idx
  on project_snapshots (project_id, snapshot_date desc);
create index if not exists project_snapshots_captured_at_idx
  on project_snapshots (captured_at desc);

create table if not exists project_status_changes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  changed_at timestamptz not null default now(),
  field_name text not null,
  old_value text,
  new_value text
);

create index if not exists project_status_changes_project_idx
  on project_status_changes (project_id, changed_at desc);
create index if not exists project_status_changes_changed_at_idx
  on project_status_changes (changed_at desc);

create table if not exists substations (
  id uuid primary key default gen_random_uuid(),
  hifld_id text not null unique,
  name text,
  owner text,
  voltage_kv numeric,
  lat numeric,
  lng numeric,
  geom geometry(Point, 4326),
  source text not null default 'HIFLD_NEXT',
  first_seen_at timestamptz not null default now(),
  last_updated_at timestamptz not null default now()
);

create index if not exists substations_geom_idx on substations using gist (geom);
