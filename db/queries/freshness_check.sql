select exists (
  select 1
  from project_snapshots
  where captured_at >= now() - interval '25 hours'
) as has_recent_snapshot;
