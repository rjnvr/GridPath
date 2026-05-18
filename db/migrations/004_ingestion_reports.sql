-- Source/report metadata for official queue snapshots.
-- This lets the app explain historical coverage by ISO without implying CAISO
-- has the same archive depth as ERCOT.

create table if not exists ingestion_reports (
  id uuid primary key default gen_random_uuid(),
  iso text not null,
  report_name text not null,
  source_url text not null,
  report_date date not null,
  projects_seen integer not null default 0,
  captured_at timestamptz not null default now(),
  unique (iso, source_url)
);

create index if not exists ingestion_reports_iso_date_idx
  on ingestion_reports (iso, report_date desc);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'ingestion_user') then
    grant select, insert, update, delete on ingestion_reports to ingestion_user;
  end if;
end $$;
