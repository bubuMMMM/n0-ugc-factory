create table if not exists generation_projects (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  brand_profile_id uuid not null references brand_profiles(id) on delete cascade,
  website text not null,
  domain text not null,
  status text not null default 'active' check (status in ('active','expired','revoked')),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists generation_projects_brand_idx on generation_projects(brand_profile_id);
create index if not exists generation_projects_expiry_idx on generation_projects(expires_at);

create table if not exists api_rate_limits (
  scope text not null,
  key_hash text not null,
  window_start bigint not null,
  hits integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key(scope,key_hash,window_start)
);

create index if not exists api_rate_limits_updated_idx on api_rate_limits(updated_at);
