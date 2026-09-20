create table if not exists video_renders (
  id uuid primary key default gen_random_uuid(),
  generation_project_id uuid not null references generation_projects(id) on delete cascade,
  brand_profile_id uuid not null references brand_profiles(id) on delete cascade,
  video_id uuid not null references video_intelligence(id) on delete cascade,
  hook_assignment_id uuid not null references hook_assignments(id) on delete cascade,
  hook_hash text not null,
  render_version text not null default 'render-v1',
  status text not null default 'processing' check (status in ('processing','ready','error')),
  blob_url text,
  blob_pathname text,
  size_bytes bigint,
  duration_ms integer,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(generation_project_id,video_id,hook_hash)
);

create index if not exists video_renders_project_idx
  on video_renders(generation_project_id,status,created_at desc);
