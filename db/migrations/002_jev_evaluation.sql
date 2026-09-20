alter table if exists hook_assignments
  add column if not exists jev_accept_probability real,
  add column if not exists jev_answers jsonb not null default '{}'::jsonb,
  add column if not exists evaluator_model text,
  add column if not exists evaluation_version text;

create index if not exists hook_assignments_jev_accept_idx
  on hook_assignments(brand_profile_id, jev_accept_probability desc);
