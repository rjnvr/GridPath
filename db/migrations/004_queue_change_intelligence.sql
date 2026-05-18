-- Queue Change Intelligence: source report tracking and classified event layer.

create table if not exists source_reports (
  id uuid primary key default gen_random_uuid(),
  iso text not null,
  source_url text not null,
  source_name text,
  published_at timestamptz,
  report_date date,
  status text not null default 'running',
  stats jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (iso, source_url),
  check (status in ('running', 'success', 'failed'))
);

create index if not exists source_reports_iso_completed_idx
  on source_reports (iso, completed_at desc);
create index if not exists source_reports_status_idx
  on source_reports (status, completed_at desc);

alter table project_snapshots
  add column if not exists source_report_id uuid references source_reports(id) on delete set null;

alter table project_status_changes
  add column if not exists source_report_id uuid references source_reports(id) on delete set null;

create index if not exists project_status_changes_source_report_idx
  on project_status_changes (source_report_id);

delete from project_snapshots old_snapshot
using project_snapshots kept_snapshot
where old_snapshot.source_report_id is null
  and kept_snapshot.source_report_id is null
  and old_snapshot.project_id = kept_snapshot.project_id
  and old_snapshot.snapshot_date = kept_snapshot.snapshot_date
  and (
    old_snapshot.captured_at < kept_snapshot.captured_at
    or (
      old_snapshot.captured_at = kept_snapshot.captured_at
      and old_snapshot.id::text < kept_snapshot.id::text
    )
  );

create unique index if not exists project_snapshots_project_date_source_idx
  on project_snapshots (project_id, snapshot_date, source_report_id)
  where source_report_id is not null;

create unique index if not exists project_snapshots_project_date_no_source_idx
  on project_snapshots (project_id, snapshot_date)
  where source_report_id is null;

create table if not exists queue_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  source_report_id uuid references source_reports(id) on delete set null,
  event_key text not null unique,
  event_type text not null,
  severity text not null,
  title text not null,
  description text not null,
  field_name text,
  old_value text,
  new_value text,
  delta_mw numeric,
  event_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (
    event_type in (
      'new_project',
      'phase_advanced',
      'phase_regressed',
      'ia_executed',
      'energized',
      'withdrawn',
      'mw_increase',
      'mw_decrease',
      'owner_changed',
      'milestone_date_changed',
      'status_changed',
      'project_field_changed'
    )
  ),
  check (severity in ('info', 'watch', 'important', 'critical'))
);

create index if not exists queue_events_project_idx
  on queue_events (project_id, event_at desc);
create index if not exists queue_events_event_at_idx
  on queue_events (event_at desc);
create index if not exists queue_events_type_idx
  on queue_events (event_type, event_at desc);
create index if not exists queue_events_severity_idx
  on queue_events (severity, event_at desc);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'ingestion_user') then
    grant select, insert, update, delete on source_reports, queue_events to ingestion_user;
  end if;
  if exists (select 1 from pg_roles where rolname = 'readonly_user') then
    grant select on source_reports, queue_events to readonly_user;
  end if;
end;
$$;
