alter table if exists hook_assignments
  add column if not exists face_occlusion_penalty integer,
  add column if not exists layout_score integer,
  add column if not exists second_line_suppressed boolean not null default false,
  add column if not exists layout_version text;
