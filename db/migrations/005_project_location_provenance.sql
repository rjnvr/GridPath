alter table projects
  add column if not exists location_source text,
  add column if not exists location_confidence text,
  add column if not exists address text,
  add column if not exists point_of_interconnection text,
  add column if not exists location_notes text;

update projects
set
  location_source = coalesce(location_source, 'county_centroid'),
  location_confidence = coalesce(location_confidence, 'low'),
  location_notes = coalesce(location_notes, 'Derived from county centroid; not a project address.')
where lat is not null
  and lng is not null
  and location_source is null;
