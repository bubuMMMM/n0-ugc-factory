alter table if exists hook_assignments
  add column if not exists face_occlusion_penalty integer,
  add column if not exists layout_score integer,
  add column if not exists second_line_suppressed boolean not null default false;

create index if not exists hook_assignments_layout_quality_idx
  on hook_assignments(brand_profile_id, accepted, face_occlusion_penalty, layout_score desc);
