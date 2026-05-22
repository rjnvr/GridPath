-- Outcome labels: terminal-and-signal labels derived from snapshot history.
-- Foundation for withdrawal-probability scoring (effective headroom moat).
-- One row per (project, label_class, label_at). A project can have multiple
-- non-terminal signal labels over its lifetime plus at most one terminal label.

create table if not exists outcome_labels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  label_class text not null,
  label_at timestamptz not null,
  evidence jsonb not null default '{}'::jsonb,
  source text not null default 'snapshot_history',
  derived_at timestamptz not null default now(),
  check (
    label_class in (
      'energized',
      'withdrawn',
      'stalled_long',
      'transferred_owner',
      'downsized_major',
      'in_queue'
    )
  ),
  unique (project_id, label_class, label_at)
);

create index if not exists outcome_labels_project_idx
  on outcome_labels (project_id);

create index if not exists outcome_labels_class_idx
  on outcome_labels (label_class, label_at desc);

create index if not exists outcome_labels_terminal_idx
  on outcome_labels (project_id, label_at desc)
  where label_class in ('energized', 'withdrawn');

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'ingestion_user') then
    grant select, insert, update, delete on outcome_labels to ingestion_user;
  end if;
  if exists (select 1 from pg_roles where rolname = 'readonly_user') then
    grant select on outcome_labels to readonly_user;
  end if;
end;
$$;
