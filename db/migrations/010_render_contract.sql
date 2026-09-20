alter table if exists hook_assignments
  add column if not exists hook_style text not null default 'short',
  add column if not exists max_lines integer not null default 2,
  add column if not exists safe_for_auto_approval boolean not null default false;

alter table if exists hook_assignments
  drop constraint if exists hook_assignments_hook_style_check;

alter table if exists hook_assignments
  add constraint hook_assignments_hook_style_check
  check (hook_style in ('short','wall'));

alter table if exists hook_assignments
  drop constraint if exists hook_assignments_max_lines_check;

alter table if exists hook_assignments
  add constraint hook_assignments_max_lines_check
  check (max_lines between 1 and 3);

alter table if exists video_renders
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists layout_version text,
  add column if not exists font_scale real,
  add column if not exists text_rect jsonb,
  add column if not exists horizontal_align text;
