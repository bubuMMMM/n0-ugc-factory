alter table if exists video_intelligence
  add column if not exists face_boxes jsonb not null default '[]'::jsonb,
  add column if not exists safe_zone_candidates jsonb not null default '[]'::jsonb,
  add column if not exists face_occupancy_score integer,
  add column if not exists text_mode text;

alter table if exists hook_assignments
  add column if not exists face_occlusion_penalty integer,
  add column if not exists layout_score integer,
  add column if not exists font_scale real,
  add column if not exists layout_compact boolean not null default false;
