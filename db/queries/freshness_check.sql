select
  p.iso,
  max(s.captured_at) as latest_snapshot_at,
  max(r.completed_at) filter (where r.status = 'success') as latest_successful_source_report_at,
  coalesce(max(s.captured_at) >= now() - interval '25 hours', false) as snapshot_fresh,
  coalesce(max(r.completed_at) filter (where r.status = 'success') >= now() - interval '25 hours', false)
    as source_report_fresh
from projects p
left join project_snapshots s on s.project_id = p.id
left join source_reports r on r.id = s.source_report_id
-- Update this list whenever a new ISO joins SUPPORTED_ISOS in packages/shared.
where p.iso in ('ERCOT', 'CAISO')
group by p.iso
order by p.iso;
