select
  p.queue_id,
  p.project_name,
  c.changed_at,
  c.field_name,
  c.old_value,
  c.new_value
from project_status_changes c
join projects p on p.id = c.project_id
where c.changed_at::date = current_date
order by c.changed_at desc, p.queue_id, c.field_name;
