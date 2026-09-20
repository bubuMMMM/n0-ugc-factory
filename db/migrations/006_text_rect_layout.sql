alter table if exists hook_assignments
  add column if not exists text_rect jsonb,
  add column if not exists font_scale real;
