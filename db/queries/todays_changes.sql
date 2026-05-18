select
  e.severity,
  e.event_type,
  p.queue_id,
  p.project_name,
  e.event_at,
  e.title,
  e.description,
  e.old_value,
  e.new_value
from queue_events e
join projects p on p.id = e.project_id
where e.event_at::date = current_date
order by e.event_at desc, e.severity, p.queue_id, e.event_type;
